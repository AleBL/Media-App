// @vitest-environment node
import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type Server,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FetchLike } from './client';
import { createSite } from './site';

// A v4 request token: the credential of the site is an access token.
const REQUEST_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ2IjoxfQ.cmVxdWVzdA';
const SESSION = 'b'.repeat(40);

const tmdb = () =>
  vi.fn<FetchLike>(async (url) => {
    const { pathname } = new URL(url);
    const body = pathname.endsWith('/auth/request_token')
      ? { success: true, request_token: REQUEST_TOKEN }
      : pathname.endsWith('/account')
        ? { id: 7, username: 'ada' }
        : { genres: [{ id: 28, name: 'Action' }] };

    return new Response(JSON.stringify(body));
  });

describe('site functions on a Node server', () => {
  let server: Server | undefined;

  afterEach(() => {
    server?.closeAllConnections();
    server?.close();
    server = undefined;
  });

  /** A server like the dev server: the functions first, then its own pages. */
  async function start(fetch = tmdb()) {
    const functions = createSite({ credential: 'a.b.c', fetch });

    server = createServer(async (request, response) => {
      if (!(await functions(request, response))) {
        response.writeHead(200, { 'Content-Type': 'text/plain' });
        response.end('a page of the server');
      }
    });
    await new Promise<void>((resolve) =>
      server!.listen(0, '127.0.0.1', resolve),
    );

    const { port } = server.address() as AddressInfo;

    return { port, fetch };
  }

  function ask(
    port: number,
    path: string,
    options: { method?: string; headers?: Record<string, string> } = {},
  ) {
    return new Promise<{
      status: number;
      headers: IncomingHttpHeaders;
      body: string;
    }>((resolve, reject) => {
      const sent = httpRequest(
        { host: '127.0.0.1', port, path, ...options },
        (response) => {
          let body = '';

          response.setEncoding('utf8');
          response.on('data', (chunk) => (body += chunk));
          response.on('end', () =>
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              body,
            }),
          );
        },
      );

      sent.on('error', reject);
      sent.end();
    });
  }

  it('answers the TMDB requests of the app', async () => {
    const { port } = await start();

    const answer = await ask(port, '/api/tmdb?resource=genres&language=en');

    expect(answer.status).toBe(200);
    expect(answer.headers['content-type']).toContain('application/json');
    expect(JSON.parse(answer.body)).toEqual({
      ok: true,
      data: [{ id: 28, name: 'Action' }],
    });
  });

  it('starts a login that comes back to this server, each cookie in a header of its own', async () => {
    const { port, fetch } = await start();

    const answer = await ask(port, '/api/auth/login');

    expect(answer.status).toBe(302);
    expect(answer.headers.location).toBe(
      `https://www.themoviedb.org/auth/access?request_token=${REQUEST_TOKEN}`,
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body!).redirect_to).toBe(
      `http://127.0.0.1:${port}/api/auth/callback`,
    );
    expect(answer.headers['set-cookie']).toEqual([
      `media-app-login=${REQUEST_TOKEN}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax`,
      'media-app-login-failure=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    ]);
  });

  it('hands the cookies of the browser to the functions', async () => {
    const { port, fetch } = await start();

    const answer = await ask(port, '/api/auth/session', {
      headers: { Cookie: `theme=dark; media-app-session=${SESSION}` },
    });

    expect(JSON.parse(answer.body)).toEqual({
      status: 'authenticated',
      account: { id: 7, username: 'ada' },
    });
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get('session_id')).toBe(
      SESSION,
    );
  });

  it('hands the method and where the request comes from', async () => {
    const { port } = await start();
    const logout = (origin: string) =>
      ask(port, '/api/auth/logout', {
        method: 'POST',
        headers: { Origin: origin },
      });

    expect((await logout(`http://127.0.0.1:${port}`)).status).toBe(200);
    expect((await logout('https://evil.test')).status).toBe(403);
    expect((await ask(port, '/api/auth/logout')).status).toBe(405);
  });

  it.each(['/', '/api', '/api/other', '/api/auth', '/api/auth/login/x'])(
    'leaves %s to the server',
    async (path) => {
      const { port, fetch } = await start();

      const answer = await ask(port, path);

      expect(answer.body).toBe('a page of the server');
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
