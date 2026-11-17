// @vitest-environment node
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Vercel does not build the functions of the site with Vite: it compiles
// each file of api/ with the tsconfig.json nearest to it and Node runs what
// comes out. Every other test goes through Vite, which also finds the files
// that Node does not, so they all passed while each function failed on
// Vercel before answering. Here the functions are built the same way and
// loaded by Node itself.

const root = fileURLToPath(new URL('../../', import.meta.url));
const apiDir = join(root, 'api');

// What Vercel deploys, with the method each function answers.
const FUNCTIONS: Record<string, string> = {
  'api/tmdb': 'GET',
  'api/auth/login': 'GET',
  'api/auth/callback': 'GET',
  'api/auth/session': 'GET',
  'api/auth/logout': 'POST',
  // and POST, for a change: see below
  'api/account': 'GET',
};

type Handler = (request: Request) => Promise<Response>;

const sources = () =>
  readdirSync(apiDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
    .map((file) => join(apiDir, file));

const message = (diagnostic: ts.Diagnostic) =>
  ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

/** Compiles the functions into `outDir`, returning what TypeScript objects. */
function build(outDir: string) {
  const configFile = ts.findConfigFile(apiDir, ts.sys.fileExists);
  const config =
    configFile &&
    ts.getParsedCommandLineOfConfigFile(
      configFile,
      { noEmit: false, outDir, rootDir: root },
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
          throw new Error(message(diagnostic));
        },
      },
    );

  if (!config) {
    return ['No tsconfig.json for api/'];
  }

  const program = ts.createProgram(sources(), config.options);
  const emitted = program.emit();

  return [...ts.getPreEmitDiagnostics(program), ...emitted.diagnostics].map(
    message,
  );
}

describe('site functions, built as Vercel builds them', () => {
  let outDir = '';
  let problems: string[] = [];

  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), 'media-app-functions-'));
    problems = build(outDir);
    // Read when a function is loaded. Empty, so nothing here reaches TMDB.
    vi.stubEnv('TMDB_READ_TOKEN', '');
  }, 30_000);

  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(outDir, { recursive: true, force: true });
  });

  // Node's own require, not the one of the tests.
  const load = (name: string) =>
    createRequire(import.meta.url)(join(outDir, `${name}.js`)) as Record<
      string,
      Handler
    >;

  it('compiles with the tsconfig.json that Vercel finds', () => {
    expect(problems).toEqual([]);
  });

  it('has a function for each file of api/', () => {
    const names = sources().map((file) =>
      relative(root, file).replaceAll('\\', '/').replace(/\.ts$/, ''),
    );

    expect(names.sort()).toEqual(Object.keys(FUNCTIONS).sort());
  });

  it.each(Object.entries(FUNCTIONS))(
    'loads %s, which answers %s',
    (name, method) => {
      expect(load(name)[method]).toBeTypeOf('function');
    },
  );

  it('answers a TMDB request', async () => {
    const response = await load('api/tmdb').GET(
      new Request('https://site.test/api/tmdb?resource=genres&language=en'),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: { code: 'missing-credential' },
    });
  });

  it('answers who is signed in', async () => {
    const response = await load('api/auth/session').GET(
      new Request('https://site.test/api/auth/session'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'anonymous' });
  });

  it('answers that nobody signed in has no lists to read or change', async () => {
    const { GET, POST } = load('api/account');
    const read = await GET(
      new Request(
        'https://site.test/api/account?resource=states&type=movie&id=603',
      ),
    );
    const change = await POST(
      new Request(
        'https://site.test/api/account?resource=mark&list=watchlist&type=movie&id=603&value=true',
        { method: 'POST', headers: { origin: 'https://site.test' } },
      ),
    );

    for (const response of [read, change]) {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        ok: false,
        error: { code: 'signed-out' },
      });
    }
  });
});
