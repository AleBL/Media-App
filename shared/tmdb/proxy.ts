import type { Result, TmdbErrorCode, TmdbFailure } from '../api';

/** The path of the site where this proxy answers. */
export { TMDB_PROXY_PATH } from '../api';
import { createTmdbClient, TmdbError, type FetchLike } from './client';
import {
  parseDetailsRequest,
  parseLanguage,
  parseListRequest,
  parseSearchRequest,
} from './validation';

export interface TmdbProxyOptions {
  /** The TMDB credential kept by the server, when one is configured. */
  credential: string | undefined;
  fetch?: FetchLike;
  baseUrl?: string;
}

// What the browser is told when a request fails. A credential that TMDB
// refuses is the site's problem, not the visitor's, so it is not a 401: only
// a session that is missing or over is.
export const HTTP_STATUS: Record<TmdbErrorCode, number> = {
  'invalid-request': 400,
  'not-found': 404,
  'rate-limited': 429,
  'missing-credential': 503,
  unauthorized: 502,
  server: 502,
  network: 502,
  timeout: 504,
  'signed-out': 401,
  // Signed in, but without what this needs: a new sign in gives it.
  'sign-in-again': 403,
};

// Answers are the same for everyone, so the CDN in front of the function
// keeps them and most visits never reach TMDB. The browser always asks.
const SEARCH_CACHE =
  'public, max-age=0, s-maxage=300, stale-while-revalidate=3600';
const GENRES_CACHE =
  'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';
// Where to watch changes from one day to the next, the rest hardly ever.
const DETAILS_CACHE =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
// What is trending or popular changes during the day.
const LIST_CACHE =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

function respond(status: number, body: Result<unknown>, cache = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function failure(error: TmdbFailure, headers: Record<string, string> = {}) {
  const response = respond(HTTP_STATUS[error.code], { ok: false, error });

  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }

  return response;
}

export function toFailure(error: unknown): TmdbFailure {
  if (error instanceof TmdbError) {
    return {
      code: error.code,
      status: error.status,
      // what TMDB said, when it said something
      message: error.message === error.code ? undefined : error.message,
    };
  }

  // Nothing about an unexpected error is told to the outside.
  return { code: 'server' };
}

/**
 * The web version of the app cannot hold a TMDB credential: everything a
 * browser loads is public. This answers its TMDB requests instead, with the
 * credential that stays on the server.
 *
 * It is not a general proxy. It only does what the app does (searching
 * movies, tv shows or everything, listing genres, the lists of the home page
 * and the page of a title), checks every parameter the same way the desktop
 * app checks what its window sends, and answers in the shape of
 * shared/api.ts, so there is nothing to gain from calling it instead of TMDB.
 *
 *   GET ?resource=search&type=movie&query=matrix&page=1&language=en
 *   GET ?resource=search&type=multi&query=keanu&page=1&language=en
 *   GET ?resource=genres&language=en
 *   GET ?resource=regions
 *   GET ?resource=details&type=movie&id=603&language=en&region=US
 *   GET ?resource=list&list=trending&language=en
 */
export function createTmdbProxy(options: TmdbProxyOptions) {
  const credential = options.credential?.trim() || null;
  const client = createTmdbClient({
    getCredential: () => credential,
    fetch: options.fetch ?? ((url, init) => fetch(url, init)),
    baseUrl: options.baseUrl,
    // A function has a few seconds to answer: waiting to try again after
    // "too many requests" is left to whoever is asking.
    retries: 0,
  });

  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return failure({ code: 'invalid-request' }, { Allow: 'GET' });
    }

    const params = new URL(request.url).searchParams;

    try {
      switch (params.get('resource')) {
        case 'search': {
          const search = parseSearchRequest({
            type: params.get('type'),
            query: params.get('query'),
            page: Number(params.get('page')),
            language: params.get('language'),
          });

          return search
            ? respond(
                200,
                { ok: true, data: await client.search(search) },
                SEARCH_CACHE,
              )
            : failure({ code: 'invalid-request' });
        }

        case 'genres': {
          const language = parseLanguage(params.get('language'));

          return language
            ? respond(
                200,
                { ok: true, data: await client.genres(language) },
                GENRES_CACHE,
              )
            : failure({ code: 'invalid-request' });
        }

        // The countries change as rarely as the genres.
        case 'regions':
          return respond(
            200,
            { ok: true, data: await client.regions() },
            GENRES_CACHE,
          );

        case 'details': {
          const details = parseDetailsRequest({
            type: params.get('type'),
            id: Number(params.get('id')),
            language: params.get('language'),
            region: params.get('region'),
          });

          return details
            ? respond(
                200,
                { ok: true, data: await client.details(details) },
                DETAILS_CACHE,
              )
            : failure({ code: 'invalid-request' });
        }

        case 'list': {
          const list = parseListRequest({
            list: params.get('list'),
            language: params.get('language'),
          });

          return list
            ? respond(
                200,
                { ok: true, data: await client.list(list) },
                LIST_CACHE,
              )
            : failure({ code: 'invalid-request' });
        }

        default:
          return failure({ code: 'invalid-request' });
      }
    } catch (error) {
      return failure(toFailure(error));
    }
  };
}

export type TmdbProxy = ReturnType<typeof createTmdbProxy>;
