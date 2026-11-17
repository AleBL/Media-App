import type { IncomingMessage, ServerResponse } from 'node:http';
import { ACCOUNT_PATH, AUTH_PATHS, TMDB_PROXY_PATH } from '../api';
import { createTmdbProxy, type TmdbProxyOptions } from './proxy';
import { createWebAccount } from './web-account';
import { createWebAuth, type WebAuthOptions } from './web-auth';

/**
 * The /api functions for servers that are not Vercel (Vite dev/preview and
 * the E2E server), with the same code. Answers `true` when it handled the
 * request; anything else is left to the server.
 */
export function createSite(options: TmdbProxyOptions & WebAuthOptions) {
  const proxy = createTmdbProxy(options);
  const auth = createWebAuth(options);
  const account = createWebAccount(options);
  const authPaths: readonly string[] = Object.values(AUTH_PATHS);

  return async function answer(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> {
    const url = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? 'localhost'}`,
    );
    const handle =
      url.pathname === TMDB_PROXY_PATH
        ? proxy
        : url.pathname === ACCOUNT_PATH
          ? account
          : authPaths.includes(url.pathname)
            ? auth
            : null;

    if (!handle) {
      return false;
    }

    const headers = new Headers();

    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') {
        headers.set(name, value);
      }
    }

    // None of the functions reads a body.
    const result = await handle(
      new Request(url, { method: request.method, headers }),
    );
    // Each cookie is a header of its own: joined in one line, the browser
    // would only see the first.
    const cookies = result.headers.getSetCookie();

    response.statusCode = result.status;
    result.headers.forEach((value, name) => {
      if (name !== 'set-cookie') {
        response.setHeader(name, value);
      }
    });

    if (cookies.length > 0) {
      response.setHeader('Set-Cookie', cookies);
    }

    response.end(await result.text());

    return true;
  };
}

export type Site = ReturnType<typeof createSite>;
