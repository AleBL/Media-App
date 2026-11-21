import {
  AUTH_PATHS,
  type LoginFailure,
  type Result,
  type SessionState,
} from '../api';
import { createTmdbClient, type Access, type FetchLike } from './client';
import {
  authorizeUrl,
  isSessionExpired,
  isTokenNotApproved,
  toLoginFailure,
} from './login';

export interface WebAuthOptions {
  /** The server's TMDB credential, when configured. */
  credential: string | undefined;
  fetch?: FetchLike;
  baseUrl?: string;
  /** Replaces the TMDB website in tests. */
  website?: string;
}

/** Every login ends on the account page. */
const ACCOUNT_PAGE = '/#/account';

// TMDB forgets a request token after 60 minutes (v3) or 15 (v4).
const LOGIN_SECONDS = 60 * 60;
// Renewed on every visit.
const SESSION_SECONDS = 180 * 24 * 60 * 60;
// Long enough for the app to load and read it.
const FAILURE_SECONDS = 60;

const COOKIES = {
  /** The request token of a pending login. */
  login: 'media-app-login',
  /** TMDB's session_id: works as a password. */
  session: 'media-app-session',
  /** The user's v4 access token: works as a password too. */
  access: 'media-app-access',
  /** The v4 account id, which the lists need. */
  accountObject: 'media-app-account',
  watchedList: 'media-app-watched-list',
  episodesList: 'media-app-episodes-list',
  /** Why the last login failed, until the app reads it. */
  failure: 'media-app-login-failure',
} as const;

type CookieName = keyof typeof COOKIES;

const FAILURES: readonly string[] = [
  'denied',
  'timeout',
  'network',
  'unavailable',
] satisfies LoginFailure[];

// TMDB tokens are 40 hex characters (v3) or a JWT (v4). This shape is safe
// in a cookie and in a url.
const COOKIE_VALUE = /^[\w.-]{1,2048}$/;

const ANONYMOUS: SessionState = { status: 'anonymous' };

function readCookie(request: Request, name: string) {
  for (const pair of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = pair.indexOf('=');

    if (separator > 0 && pair.slice(0, separator).trim() === name) {
      const value = pair.slice(separator + 1).trim();

      return COOKIE_VALUE.test(value) ? value : undefined;
    }
  }

  return undefined;
}

/** The site's address as the browser sees it (behind Vercel's proxy, from the forwarded headers). */
function siteAddress(request: Request) {
  const url = new URL(request.url);
  const firstValue = (name: string) =>
    request.headers.get(name)?.split(',')[0].trim() || undefined;
  const protocol = firstValue('x-forwarded-proto') ?? url.protocol.slice(0, -1);
  const host =
    firstValue('x-forwarded-host') ?? request.headers.get('host') ?? url.host;

  try {
    const secure = protocol === 'https';

    return {
      secure,
      origin: new URL(`${secure ? 'https' : 'http'}://${host}`).origin,
    };
  } catch {
    return { secure: url.protocol === 'https:', origin: url.origin };
  }
}

/** Reads the request's cookies and builds the response. */
export function httpContext(request: Request) {
  const { origin, secure } = siteAddress(request);
  // Per-visitor answers: never cached.
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  // `__Host-` makes the browser accept the cookie only from this exact host,
  // so a neighbour on the same domain cannot plant a session. Plain http is
  // the dev server.
  const cookieName = (cookie: CookieName) =>
    `${secure ? '__Host-' : ''}${COOKIES[cookie]}`;

  // HttpOnly hides the cookie from scripts. Lax, not Strict: the redirect
  // back from TMDB starts on another site and must carry the login cookie.
  function setCookie(cookie: CookieName, value: string, seconds: number) {
    headers.append(
      'Set-Cookie',
      `${cookieName(cookie)}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; ` +
        `SameSite=Lax${secure ? '; Secure' : ''}`,
    );
  }

  return {
    origin,
    getCookie: (cookie: CookieName) => readCookie(request, cookieName(cookie)),
    setCookie,
    deleteCookie: (cookie: CookieName) => setCookie(cookie, '', 0),

    redirect(location: string) {
      headers.set('Location', location);

      return new Response(null, { status: 302, headers });
    },

    /** Redirects to the app, which then asks for the session. */
    backToApp(failure?: LoginFailure) {
      if (failure) {
        setCookie('failure', failure, FAILURE_SECONDS);
      }

      return this.redirect(ACCOUNT_PAGE);
    },

    json(body: SessionState | Result<unknown>, status = 200) {
      headers.set('Content-Type', 'application/json; charset=utf-8');

      return new Response(JSON.stringify(body), { status, headers });
    },

    reject(status: number, allow?: string) {
      if (allow) {
        headers.set('Allow', allow);
      }

      return new Response(null, { status, headers });
    },
  };
}

type HttpContext = ReturnType<typeof httpContext>;

export function readAccess(http: HttpContext): Access | null {
  const sessionId = http.getCookie('session');
  const accessToken = http.getCookie('access');
  const accountObjectId = http.getCookie('accountObject');

  if (!sessionId) {
    return null;
  }

  return accessToken && accountObjectId
    ? { sessionId, accessToken, accountObjectId }
    : { sessionId };
}

/** Saves (or renews for another 180 days) what signing in gave. */
function saveAccess(http: HttpContext, access: Access) {
  http.setCookie('session', access.sessionId, SESSION_SECONDS);

  if (access.accessToken && access.accountObjectId) {
    http.setCookie('access', access.accessToken, SESSION_SECONDS);
    http.setCookie('accountObject', access.accountObjectId, SESSION_SECONDS);
  }
}

export function clearAccess(http: HttpContext) {
  http.deleteCookie('session');
  http.deleteCookie('access');
  http.deleteCookie('accountObject');
  http.deleteCookie('watchedList');
  http.deleteCookie('episodesList');
}

/** Not a secret: TMDB only shows the list to its owner. */
function listIdCookie(http: HttpContext, name: 'watchedList' | 'episodesList') {
  return {
    get: () => {
      const id = Number(http.getCookie(name));

      return Number.isInteger(id) && id > 0 ? id : undefined;
    },
    set: (id: number | undefined) =>
      id === undefined
        ? http.deleteCookie(name)
        : http.setCookie(name, String(id), SESSION_SECONDS),
  };
}

export const watchedListCache = (http: HttpContext) =>
  listIdCookie(http, 'watchedList');

export const episodesListCache = (http: HttpContext) =>
  listIdCookie(http, 'episodesList');

/**
 * TMDB sign-in for the web version. The site keeps the session in an
 * HttpOnly cookie; the page is only told who signed in.
 *
 *   GET  /api/auth/login     redirects to the TMDB approval page
 *   GET  /api/auth/callback  where TMDB sends the browser back
 *   GET  /api/auth/session   the SessionState
 *   POST /api/auth/logout    ends the session, here and at TMDB
 */
export function createWebAuth(options: WebAuthOptions) {
  const credential = options.credential?.trim() || null;
  const tmdb = createTmdbClient({
    getCredential: () => credential,
    fetch: options.fetch ?? ((url, init) => fetch(url, init)),
    baseUrl: options.baseUrl,
    // A function has a few seconds, and the callback makes two requests.
    timeoutMs: 4000,
    retries: 0,
  });

  async function revokeAccess(unused: Access) {
    try {
      await tmdb.deleteSession(unused);
    } catch {
      // The browser forgets it either way.
    }
  }

  async function login(http: HttpContext) {
    const callback = `${http.origin}${AUTH_PATHS.callback}`;
    let requestToken: string;

    try {
      requestToken = await tmdb.createRequestToken(callback);
    } catch (error) {
      return http.backToApp(toLoginFailure(error));
    }

    if (!COOKIE_VALUE.test(requestToken)) {
      return http.backToApp('unavailable');
    }

    http.setCookie('login', requestToken, LOGIN_SECONDS);
    http.deleteCookie('failure');

    return http.redirect(
      authorizeUrl(requestToken, callback, options.website || undefined),
    );
  }

  // Anyone can open this url with any parameters, so they decide nothing:
  // the token exchanged is the one in this browser's cookie, and TMDB says
  // whether it was approved. At worst, an early visit ends a pending login.
  async function callback(http: HttpContext, returnedToken: string | null) {
    const requestToken = http.getCookie('login');

    // v3 returns the token in the url (v4 returns nothing). A different one
    // belongs to an older login or a guess: the pending login is left alone.
    if (
      !requestToken ||
      (returnedToken !== null && returnedToken !== requestToken)
    ) {
      return http.backToApp();
    }

    // A request token is exchanged only once.
    http.deleteCookie('login');

    let granted: Access;

    try {
      granted = await tmdb.createSession(requestToken);
    } catch (error) {
      // TMDB only redirects after the user answered, so a refused token
      // means the user denied it.
      return http.backToApp(
        isTokenNotApproved(error) ? 'denied' : toLoginFailure(error),
      );
    }

    if (
      ![granted.sessionId, granted.accessToken, granted.accountObjectId].every(
        (value) => value === undefined || COOKIE_VALUE.test(value),
      )
    ) {
      await revokeAccess(granted);

      return http.backToApp('unavailable');
    }

    const previous = readAccess(http);

    if (previous && previous.sessionId !== granted.sessionId) {
      await revokeAccess(previous);
    }

    saveAccess(http, granted);
    http.deleteCookie('failure');

    // Signed in with a v3 key: drop what an earlier v4 login left.
    if (!granted.accessToken) {
      http.deleteCookie('access');
      http.deleteCookie('accountObject');
    }

    return http.backToApp();
  }

  async function session(http: HttpContext) {
    const failure = http.getCookie('failure');
    const saved = readAccess(http);

    // A failed login is reported once.
    if (failure) {
      http.deleteCookie('failure');
    }

    if (!saved) {
      return http.json(
        failure && FAILURES.includes(failure)
          ? { status: 'error', reason: failure as LoginFailure }
          : ANONYMOUS,
      );
    }

    try {
      const account = await tmdb.account(saved.sessionId);

      saveAccess(http, saved);

      return http.json({ status: 'authenticated', account });
    } catch (error) {
      if (isSessionExpired(error)) {
        clearAccess(http);

        return http.json(ANONYMOUS);
      }

      // TMDB unreachable says nothing about the session: the cookie stays.
      return http.json({ status: 'error', reason: toLoginFailure(error) }, 502);
    }
  }

  async function logout(http: HttpContext, origin: string | null) {
    // Only the app itself may sign anyone out, whatever SameSite does.
    if (origin !== http.origin) {
      return http.reject(403);
    }

    const previous = readAccess(http);

    clearAccess(http);
    http.deleteCookie('login');
    http.deleteCookie('failure');

    if (previous) {
      await revokeAccess(previous);
    }

    return http.json(ANONYMOUS);
  }

  return async function handle(request: Request): Promise<Response> {
    const http = httpContext(request);
    const url = new URL(request.url);
    const isGet = request.method === 'GET';

    switch (url.pathname) {
      case AUTH_PATHS.login:
        return isGet ? login(http) : http.reject(405, 'GET');

      case AUTH_PATHS.callback:
        return isGet
          ? callback(http, url.searchParams.get('request_token'))
          : http.reject(405, 'GET');

      case AUTH_PATHS.session:
        return isGet ? session(http) : http.reject(405, 'GET');

      case AUTH_PATHS.logout:
        return request.method === 'POST'
          ? logout(http, request.headers.get('origin'))
          : http.reject(405, 'POST');

      default:
        return http.reject(404);
    }
  };
}

export type WebAuth = ReturnType<typeof createWebAuth>;
