import type { Result, TmdbErrorCode, TmdbFailure } from '../api';

export { TMDB_PROXY_PATH } from '../api';
import { createTmdbClient, TmdbError, type FetchLike } from './client';
import {
  parseDetailsRequest,
  parsePersonRequest,
  parseLanguage,
  parseListRequest,
  parseSearchRequest,
} from './validation';

export interface TmdbProxyOptions {
  /** The server's TMDB credential, when configured. */
  credential: string | undefined;
  fetch?: FetchLike;
  baseUrl?: string;
}

// A credential TMDB refuses is the site's problem, so it is a 502, not a
// 401: only a missing or expired session is.
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
  'sign-in-again': 403,
};

// The same for everyone, so the CDN caches them; the browser always asks.
const SEARCH_CACHE =
  'public, max-age=0, s-maxage=300, stale-while-revalidate=3600';
const GENRES_CACHE =
  'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';
const DETAILS_CACHE =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
const LIST_CACHE =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

function jsonResponse(
  status: number,
  body: Result<unknown>,
  cache = 'no-store',
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function errorResponse(
  error: TmdbFailure,
  headers: Record<string, string> = {},
) {
  const response = jsonResponse(HTTP_STATUS[error.code], { ok: false, error });

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
      // TMDB's message, when it sent one.
      message: error.message === error.code ? undefined : error.message,
    };
  }

  // Unexpected errors reveal nothing.
  return { code: 'server' };
}

/**
 * Answers the TMDB requests of the web version with the server's credential
 * (a browser cannot hold one). Not a general proxy: only what the app does,
 * validated like the desktop IPC.
 *
 *   GET ?resource=search&type=movie&query=matrix&page=1&language=en
 *   GET ?resource=search&type=multi&query=keanu&page=1&language=en
 *   GET ?resource=genres&language=en
 *   GET ?resource=regions
 *   GET ?resource=details&type=movie&id=603&language=en&region=US
 *   GET ?resource=person&id=6384&language=en
 *   GET ?resource=list&list=trending&language=en
 */
export function createTmdbProxy(options: TmdbProxyOptions) {
  const credential = options.credential?.trim() || null;
  const client = createTmdbClient({
    getCredential: () => credential,
    fetch: options.fetch ?? ((url, init) => fetch(url, init)),
    baseUrl: options.baseUrl,
    // A function has a few seconds: retrying a 429 is left to the caller.
    retries: 0,
  });

  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return errorResponse({ code: 'invalid-request' }, { Allow: 'GET' });
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
            ? jsonResponse(
                200,
                { ok: true, data: await client.search(search) },
                SEARCH_CACHE,
              )
            : errorResponse({ code: 'invalid-request' });
        }

        case 'genres': {
          const language = parseLanguage(params.get('language'));

          return language
            ? jsonResponse(
                200,
                { ok: true, data: await client.genres(language) },
                GENRES_CACHE,
              )
            : errorResponse({ code: 'invalid-request' });
        }

        // Change as rarely as the genres.
        case 'regions':
          return jsonResponse(
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
            ? jsonResponse(
                200,
                { ok: true, data: await client.details(details) },
                DETAILS_CACHE,
              )
            : errorResponse({ code: 'invalid-request' });
        }

        case 'person': {
          const person = parsePersonRequest({
            id: Number(params.get('id')),
            language: params.get('language'),
          });

          return person
            ? jsonResponse(
                200,
                { ok: true, data: await client.person(person) },
                DETAILS_CACHE,
              )
            : errorResponse({ code: 'invalid-request' });
        }

        case 'list': {
          const list = parseListRequest({
            list: params.get('list'),
            language: params.get('language'),
          });

          return list
            ? jsonResponse(
                200,
                { ok: true, data: await client.list(list) },
                LIST_CACHE,
              )
            : errorResponse({ code: 'invalid-request' });
        }

        default:
          return errorResponse({ code: 'invalid-request' });
      }
    } catch (error) {
      return errorResponse(toFailure(error));
    }
  };
}

export type TmdbProxy = ReturnType<typeof createTmdbProxy>;
