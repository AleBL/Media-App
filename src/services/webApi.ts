import {
  ACCOUNT_PATH,
  AUTH_PATHS,
  TMDB_PROXY_PATH,
  type CredentialStatus,
  type MediaAppApi,
  type Result,
  type SessionState,
} from '@shared/api';
import { encodeSeasons } from '@shared/tmdb/episodes';

const TIMEOUT_MS = 12_000;

// The site keeps the credential on the server: there is no user key here.
const SERVER_CREDENTIAL: CredentialStatus = {
  hasKey: false,
  persisted: false,
  encrypted: false,
  builtIn: true,
};

const NO_SESSION: SessionState = { status: 'anonymous' };

const LOGIN_FAILURES = ['denied', 'timeout', 'network', 'unavailable'];

export type WebFetch = (
  url: string,
  init: {
    method?: string;
    headers: Record<string, string>;
    signal: AbortSignal;
  },
) => Promise<Pick<Response, 'status' | 'json'>>;

type SiteResponse =
  { failed: 'timeout' | 'network' } | { status: number; body: unknown };

export interface WebBrowser {
  navigate(url: string): void;
  /** Called once when the page comes back from the back/forward cache. */
  onRestored(listener: () => void): void;
}

const windowBrowser: WebBrowser = {
  navigate: (url) => window.location.assign(url),
  onRestored(listener) {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.removeEventListener('pageshow', onPageShow);
        listener();
      }
    };

    window.addEventListener('pageshow', onPageShow);
  },
};

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

// Never `pending` on the web: the approval happens on the TMDB website.
function isSessionState(value: unknown): value is SessionState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const { status, reason, account } = value as Record<string, unknown>;

  if (status === 'anonymous') {
    return true;
  }

  if (status === 'error') {
    return typeof reason === 'string' && LOGIN_FAILURES.includes(reason);
  }

  return (
    status === 'authenticated' &&
    typeof account === 'object' &&
    account !== null &&
    typeof (account as { id?: unknown }).id === 'number' &&
    typeof (account as { username?: unknown }).username === 'string'
  );
}

/**
 * The api of shared/api.ts for the web version: requests go to the site's
 * functions (/api), which hold the credential and the session.
 */
export function createWebApi(
  fetch: WebFetch = (url, init) => window.fetch(url, init),
  browser: WebBrowser = windowBrowser,
): MediaAppApi {
  async function fetchJson(
    url: string,
    method?: string,
  ): Promise<SiteResponse> {
    let response: Awaited<ReturnType<WebFetch>>;

    try {
      response = await fetch(url, {
        ...(method ? { method } : {}),
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';

      return { failed: timedOut ? 'timeout' : 'network' };
    }

    try {
      return { status: response.status, body: await response.json() };
    } catch {
      return { status: response.status, body: undefined };
    }
  }

  async function callSite<T>(
    params: Record<string, string>,
    path = TMDB_PROXY_PATH,
    method?: string,
  ): Promise<Result<T>> {
    const response = await fetchJson(
      `${path}?${new URLSearchParams(params)}`,
      method,
    );

    if ('failed' in response) {
      return { ok: false, error: { code: response.failed } };
    }

    if (isResult(response.body)) {
      return response.body as Result<T>;
    }

    // Something else answered, such as an error page of the host.
    return { ok: false, error: { code: 'server', status: response.status } };
  }

  let session = NO_SESSION;

  async function callSession(path: string, method?: string) {
    const response = await fetchJson(path, method);

    if ('failed' in response) {
      return { status: 'error', reason: 'network' } satisfies SessionState;
    }

    return isSessionState(response.body)
      ? response.body
      : ({ status: 'error', reason: 'unavailable' } satisfies SessionState);
  }

  async function getSession() {
    session = await callSession(AUTH_PATHS.session);

    return session;
  }

  return {
    platform: 'web',
    // The browser follows the system theme by itself.
    setNativeTheme: () => {},
    clearCache: async () => ({ ok: true, data: null }),
    tmdb: {
      search: ({ type, query, page, language, year }) =>
        callSite({
          resource: 'search',
          type,
          query,
          page: String(page),
          language,
          ...(year !== undefined && { year: String(year) }),
        }),
      discover: (request) =>
        callSite({
          resource: 'discover',
          type: request.type,
          page: String(request.page),
          language: request.language,
          region: request.region,
          sort: request.sort,
          ...(request.genres?.length && { genres: request.genres.join(',') }),
          ...(request.fromYear !== undefined && {
            from: String(request.fromYear),
          }),
          ...(request.toYear !== undefined && { to: String(request.toYear) }),
          ...(request.minRating !== undefined && {
            rating: String(request.minRating),
          }),
          ...(request.originalLanguage && {
            original: request.originalLanguage,
          }),
          ...(request.ageRating && { age: request.ageRating }),
          ...(request.providers?.length && {
            providers: request.providers.join(','),
          }),
        }),
      discoverFilters: ({ type, language, region }) =>
        callSite({ resource: 'discover-filters', type, language, region }),
      genres: (language) => callSite({ resource: 'genres', language }),
      details: ({ type, id, language, region }) =>
        callSite({
          resource: 'details',
          type,
          id: String(id),
          language,
          region,
        }),
      person: ({ id, language }) =>
        callSite({ resource: 'person', id: String(id), language }),
      season: ({ id, season, language }) =>
        callSite({
          resource: 'season',
          id: String(id),
          season: String(season),
          language,
        }),
      list: ({ list, language, region }) =>
        callSite({
          resource: 'list',
          list,
          language,
          ...(region && { region }),
        }),
      regions: () => callSite({ resource: 'regions' }),
    },
    account: {
      states: ({ type, id }) =>
        callSite({ resource: 'states', type, id: String(id) }, ACCOUNT_PATH),
      mark: ({ list, type, id, value }) =>
        callSite(
          {
            resource: 'mark',
            list,
            type,
            id: String(id),
            value: String(value),
          },
          ACCOUNT_PATH,
          'POST',
        ),
      rate: ({ type, id, value }) =>
        callSite(
          value === null
            ? { resource: 'unrate', type, id: String(id) }
            : { resource: 'rate', type, id: String(id), value: String(value) },
          ACCOUNT_PATH,
          'POST',
        ),
      list: ({ list, type, page, language }) =>
        callSite(
          { resource: 'list', list, type, page: String(page), language },
          ACCOUNT_PATH,
        ),
      recommendations: ({ type, language }) =>
        callSite({ resource: 'recommendations', type, language }, ACCOUNT_PATH),
    },
    watched: {
      state: ({ type, id }) =>
        callSite(
          { resource: 'watched-state', type, id: String(id) },
          ACCOUNT_PATH,
        ),
      mark: ({ type, id, value, date, language }) =>
        callSite(
          {
            resource: 'watched-mark',
            type,
            id: String(id),
            value: String(value),
            date,
            language,
          },
          ACCOUNT_PATH,
          'POST',
        ),
      list: ({ page, language }) =>
        callSite(
          { resource: 'watched-list', page: String(page), language },
          ACCOUNT_PATH,
        ),
      progress: () => callSite({ resource: 'watched-progress' }, ACCOUNT_PATH),
      // The seasons as TMDB keeps them in the comment: short in an address.
      saveProgress: ({ id, seasons, date, language }) =>
        callSite(
          {
            resource: 'watched-save-progress',
            id: String(id),
            seasons: encodeSeasons(seasons),
            date,
            language,
          },
          ACCOUNT_PATH,
          'POST',
        ),
    },
    credentials: {
      status: async () => SERVER_CREDENTIAL,
      save: async () => SERVER_CREDENTIAL,
      clear: async () => SERVER_CREDENTIAL,
    },
    auth: {
      getSession,

      // The page goes to TMDB and comes back reloaded, so this only resolves
      // when the browser restores the page from the back/forward cache.
      login() {
        browser.navigate(AUTH_PATHS.login);

        return new Promise((resolve) => {
          browser.onRestored(() => resolve(getSession()));
        });
      },

      confirmManual: getSession,
      // The site's cookie already keeps the session for 180 days.
      remember: getSession,
      async cancelLogin() {
        if (session.status !== 'authenticated') {
          session = NO_SESSION;
        }

        return session;
      },

      // Only the site can end the session: if it does not answer, the user
      // stays signed in.
      async logout() {
        const result = await callSession(AUTH_PATHS.logout, 'POST');

        if (result.status === 'anonymous') {
          session = result;
        }

        return session;
      },

      // Nothing changes while the page is open.
      onChange: () => () => {},
    },
    // A web page is always the latest version of the site.
    updates: {
      state: async () => ({ status: 'idle' }),
      install: async () => {},
      onChange: () => () => {},
    },
  };
}
