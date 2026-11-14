import {
  TMDB_PROXY_PATH,
  type CredentialStatus,
  type MediaAppApi,
  type Result,
} from '@shared/api';

const TIMEOUT_MS = 12_000;

// The site keeps the TMDB credential on its server, so the app always has
// access and there is no key of the user to save here.
const SERVER_CREDENTIAL: CredentialStatus = {
  hasKey: false,
  persisted: false,
  encrypted: false,
  builtIn: true,
};

export type WebFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<Pick<Response, 'status' | 'json'>>;

function isResult(value: unknown): value is Result<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const { ok, data, error } = value as Record<string, unknown>;

  if (ok === true) {
    return data !== undefined;
  }

  return (
    ok === false &&
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/**
 * The api of shared/api.ts for the app running as a web page, where there
 * is no preload script and no main process. TMDB requests go to a function
 * of the site (api/tmdb.ts), which answers in the same shape as the main
 * process of the desktop app does.
 */
export function createWebApi(
  fetch: WebFetch = (url, init) => window.fetch(url, init),
): MediaAppApi {
  async function ask<T>(params: Record<string, string>): Promise<Result<T>> {
    let response: Awaited<ReturnType<WebFetch>>;

    try {
      response = await fetch(
        `${TMDB_PROXY_PATH}?${new URLSearchParams(params)}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';

      return { ok: false, error: { code: timedOut ? 'timeout' : 'network' } };
    }

    try {
      const body: unknown = await response.json();

      if (isResult(body)) {
        return body as Result<T>;
      }
    } catch {
      // not JSON: handled below
    }

    // Something else answered in place of the function, such as an error
    // page of the host.
    return { ok: false, error: { code: 'server', status: response.status } };
  }

  return {
    platform: 'web',
    // The browser follows the theme of the system by itself.
    setNativeTheme: () => {},
    tmdb: {
      search: ({ type, query, page, language }) =>
        ask({ resource: 'search', type, query, page: String(page), language }),
      genres: (language) => ask({ resource: 'genres', language }),
    },
    credentials: {
      status: async () => SERVER_CREDENTIAL,
      save: async () => SERVER_CREDENTIAL,
      clear: async () => SERVER_CREDENTIAL,
    },
  };
}
