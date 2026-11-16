import {
  ACCOUNT_PATH,
  AUTH_PATHS,
  TMDB_PROXY_PATH,
  type CredentialStatus,
  type MediaAppApi,
  type Result,
  type SessionState,
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

const NO_SESSION: SessionState = { status: 'anonymous' };

const LOGIN_FAILURES = ['denied', 'timeout', 'network', 'unavailable'];

export type WebFetch = (
  url: string,
  init: {
    /** GET when missing. */
    method?: string;
    headers: Record<string, string>;
    signal: AbortSignal;
  },
) => Promise<Pick<Response, 'status' | 'json'>>;

/** A request to the site: why it has no answer, or the answer. */
type Sent =
  { failed: 'timeout' | 'network' } | { status: number; body: unknown };

/** What the api needs of the browser, besides requests. */
export interface WebBrowser {
  /** Leaves the app for another address. */
  navigate(url: string): void;
  /**
   * Calls `listener` once, when the browser brings the page back the way it
   * was left (the back button) instead of loading it again.
   */
  onRestored(listener: () => void): void;
}

const thisBrowser: WebBrowser = {
  navigate: (url) => window.location.assign(url),
  onRestored(listener) {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.removeEventListener('pageshow', restored);
        listener();
      }
    };

    window.addEventListener('pageshow', restored);
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

// The site never says `pending`: on the web the wait for the approval
// happens on the TMDB website, away from the app.
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
 * The api of shared/api.ts for the app running as a web page, where there
 * is no preload script and no main process. Its requests go to functions of
 * the site (the files in /api), which answer in the same shape as the main
 * process of the desktop app does. The TMDB credential and the session of
 * whoever signed in stay with them.
 */
export function createWebApi(
  fetch: WebFetch = (url, init) => window.fetch(url, init),
  browser: WebBrowser = thisBrowser,
): MediaAppApi {
  /** What the site answered, as JSON when it is JSON. */
  async function send(url: string, method?: string): Promise<Sent> {
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
      // not JSON: for the caller to handle
      return { status: response.status, body: undefined };
    }
  }

  async function ask<T>(
    params: Record<string, string>,
    path = TMDB_PROXY_PATH,
    method?: string,
  ): Promise<Result<T>> {
    const answer = await send(`${path}?${new URLSearchParams(params)}`, method);

    if ('failed' in answer) {
      return { ok: false, error: { code: answer.failed } };
    }

    if (isResult(answer.body)) {
      return answer.body as Result<T>;
    }

    // Something else answered in place of the function, such as an error
    // page of the host.
    return { ok: false, error: { code: 'server', status: answer.status } };
  }

  // What the site last said about the session.
  let session = NO_SESSION;

  async function askSession(path: string, method?: string) {
    const answer = await send(path, method);

    if ('failed' in answer) {
      return { status: 'error', reason: 'network' } satisfies SessionState;
    }

    return isSessionState(answer.body)
      ? answer.body
      : ({ status: 'error', reason: 'unavailable' } satisfies SessionState);
  }

  async function getSession() {
    session = await askSession(AUTH_PATHS.session);

    return session;
  }

  return {
    platform: 'web',
    // The browser follows the theme of the system by itself.
    setNativeTheme: () => {},
    tmdb: {
      search: ({ type, query, page, language }) =>
        ask({ resource: 'search', type, query, page: String(page), language }),
      genres: (language) => ask({ resource: 'genres', language }),
      details: ({ type, id, language, region }) =>
        ask({ resource: 'details', type, id: String(id), language, region }),
      list: ({ list, language }) => ask({ resource: 'list', list, language }),
    },
    // With the session in the cookie of the site, which the browser sends
    // along (shared/tmdb/web-account.ts).
    account: {
      states: ({ type, id }) =>
        ask({ resource: 'states', type, id: String(id) }, ACCOUNT_PATH),
      mark: ({ list, type, id, value }) =>
        ask(
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
        ask(
          value === null
            ? { resource: 'unrate', type, id: String(id) }
            : { resource: 'rate', type, id: String(id), value: String(value) },
          ACCOUNT_PATH,
          'POST',
        ),
      list: ({ list, type, page, language }) =>
        ask(
          { resource: 'list', list, type, page: String(page), language },
          ACCOUNT_PATH,
        ),
    },
    watched: {
      state: ({ type, id }) =>
        ask({ resource: 'watched-state', type, id: String(id) }, ACCOUNT_PATH),
      mark: ({ type, id, value, date, language }) =>
        ask(
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
        ask(
          { resource: 'watched-list', page: String(page), language },
          ACCOUNT_PATH,
        ),
    },
    credentials: {
      status: async () => SERVER_CREDENTIAL,
      save: async () => SERVER_CREDENTIAL,
      clear: async () => SERVER_CREDENTIAL,
    },
    // A web page has no safe place for a TMDB session, so the site keeps
    // it, in a cookie that scripts cannot read (shared/tmdb/web-auth.ts).
    // The page asks who is signed in, like the window of the desktop app.
    auth: {
      getSession,

      // The whole page goes to the TMDB website and comes back loaded
      // again, already signed in or with the reason why not. So this only
      // answers when the browser brings the page back as it was left.
      login() {
        browser.navigate(AUTH_PATHS.login);

        return new Promise((resolve) => {
          browser.onRestored(() => resolve(getSession()));
        });
      },

      // There is no waiting here to confirm or to give up.
      confirmManual: getSession,
      // The cookie of the site already keeps the session for 180 days.
      remember: getSession,
      async cancelLogin() {
        if (session.status !== 'authenticated') {
          session = NO_SESSION;
        }

        return session;
      },

      // Only the site can end the session: when it does not answer, whoever
      // was signed in still is.
      async logout() {
        const answer = await askSession(AUTH_PATHS.logout, 'POST');

        if (answer.status === 'anonymous') {
          session = answer;
        }

        return session;
      },

      // Nothing changes while the page is open: the login happens away
      // from it.
      onChange: () => () => {},
    },
  };
}
