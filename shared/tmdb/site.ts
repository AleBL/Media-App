import type { IncomingMessage, ServerResponse } from 'node:http';
import { AUTH_PATHS, TMDB_PROXY_PATH } from '../api';
import { createTmdbProxy, type TmdbProxyOptions } from './proxy';
import { createWebAuth, type WebAuthOptions } from './web-auth';

/**
 * The functions of the site (the files in /api, which Vercel deploys) for
 * the servers that are not Vercel: the dev and preview servers of Vite and
 * the one of the end-to-end tests. They answer the same paths with the same
 * code, so the web version works the same way everywhere.
 *
 * Answers `true` when the request was one for a function. Any other is left
 * untouched, for the server to answer.
 */
export function createSite(options: TmdbProxyOptions & WebAuthOptions) {
  const proxy = createTmdbProxy(options);
  const auth = createWebAuth(options);
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
