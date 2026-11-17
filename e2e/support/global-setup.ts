import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { APP_TOKEN } from './fake-tmdb';

const projectRoot = resolve(__dirname, '../..');

/**
 * Builds the app that the tests start, once per run.
 *
 * The build is made here, and not by whoever calls Playwright, so that the
 * app always carries the made up credential of the tests: a real token from
 * .env.local never ends up in the app under test, and the tests can check
 * that the credential stays out of the renderer.
 *
 * The files stay in dist and dist-electron afterwards. Build again before
 * packaging the app (the build scripts do).
 */
export default function globalSetup() {
  // NODE_ENV is left out: Playwright sets it to "test", which would make
  // Vite build the app in development mode instead of the way it is shipped.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name !== 'NODE_ENV'),
  );

  env.TMDB_READ_TOKEN = APP_TOKEN;

  execFileSync(
    process.execPath,
    [resolve(projectRoot, 'node_modules/vite/bin/vite.js'), 'build'],
    // The cast is for the variables that electron-env.d.ts declares as
    // always present, which only holds inside the running app.
    { cwd: projectRoot, env: env as NodeJS.ProcessEnv, stdio: 'inherit' },
  );
}
