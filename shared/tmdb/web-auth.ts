import {
  AUTH_PATHS,
  type LoginFailure,
  type Result,
  type SessionState,
} from '../api';
import { createTmdbClient, type Access, type FetchLike } from './client';
import {
  authorizeUrl,
  isSessionDenied,
  isSessionOver,
  loginFailure,
} from './login';

export interface WebAuthOptions {
  /** The TMDB credential kept by the server, when one is configured. */
  credential: string | undefined;
  fetch?: FetchLike;
  baseUrl?: string;
  /**
   * Where the user approves the access, in place of the TMDB website. For
   * tests, which cannot send a browser there.
   */
  website?: string;
}

/** The page of the app that shows who is signed in: every login ends there. */
const ACCOUNT_PAGE = '/#/account';

// TMDB forgets a request token after 60 minutes (v3) or 15 (v4).
const LOGIN_SECONDS = 60 * 60;
// Counted from the last visit: every one of them renews the cookie.
const SESSION_SECONDS = 180 * 24 * 60 * 60;
// Long enough for the app to load and ask what happened.
const FAILURE_SECONDS = 60;

const COOKIES = {
  /** The request token of a login that is waiting for the approval. */
  login: 'media-app-login',
  /** TMDB's session_id: a password of the account. */
  session: 'media-app-session',
  /** With the v4 login, the access token of the user: a password too. */
  access: 'media-app-access',
  /** With the v4 login, the id of the account in v4, which its lists take. */
  accountObject: 'media-app-account',
  /** The id of the list of watched titles, once it was found. */
  watchedList: 'media-app-watched-list',
  /** Why the last login failed, until the app is told. */
  failure: 'media-app-login-failure',
} as const;

type CookieName = keyof typeof COOKIES;

const FAILURES: readonly string[] = [
  'denied',
  'timeout',
  'network',
  'unavailable',
] satisfies LoginFailure[];

// What TMDB hands out is 40 hexadecimal characters (v3) or a JWT of a few
// hundred (v4). Anything in this shape is safe inside a cookie and inside
// an address, and a browser keeps a cookie this long.
const VALUE = /^[\w.-]{1,2048}$/;

const ANONYMOUS: SessionState = { status: 'anonymous' };

function readCookie(request: Request, name: string) {
  for (const pair of (request.headers.get('cookie') ?? '').split(';')) {
    const at = pair.indexOf('=');

    if (at > 0 && pair.slice(0, at).trim() === name) {
      const value = pair.slice(at + 1).trim();

      return VALUE.test(value) ? value : undefined;
    }
  }

  return undefined;
}

/**
 * The address of the site as the browser sees it. Behind the proxy of a
 * host such as Vercel, the address of the request itself can have another
 * protocol or host: the forwarded headers are the ones to go by.
 */
function siteOf(request: Request) {
  const url = new URL(request.url);
  const first = (name: string) =>
    request.headers.get(name)?.split(',')[0].trim() || undefined;
  const protocol = first('x-forwarded-proto') ?? url.protocol.slice(0, -1);
  const host =
    first('x-forwarded-host') ?? request.headers.get('host') ?? url.host;

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

/** One request: what the browser sent, and the answer being put together. */
export function visit(request: Request) {
  const { origin, secure } = siteOf(request);
  // Nothing here is the same for two visitors: no cache may keep it.
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  // Over https the names carry the `__Host-` prefix, which makes the browser
  // only take the cookie from this exact host: a neighbour on the same
  // domain cannot plant a session of its own. Plain http is the dev server.
  const name = (cookie: CookieName) =>
    `${secure ? '__Host-' : ''}${COOKIES[cookie]}`;

  // HttpOnly keeps the scripts of the page away from the cookie. SameSite
  // has to be Lax, not Strict: the way back from TMDB is a navigation that
  // starts on another site, and it must carry the cookie of the login.
  function keep(cookie: CookieName, value: string, seconds: number) {
    headers.append(
      'Set-Cookie',
      `${name(cookie)}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; ` +
        `SameSite=Lax${secure ? '; Secure' : ''}`,
    );
  }

  return {
    origin,
    cookie: (cookie: CookieName) => readCookie(request, name(cookie)),
    keep,
    drop: (cookie: CookieName) => keep(cookie, '', 0),

    /** Sends the browser somewhere else. */
    redirect(location: string) {
      headers.set('Location', location);

      return new Response(null, { status: 302, headers });
    },

    /** Back to the app, which asks for the session and learns the rest. */
    toApp(failure?: LoginFailure) {
      if (failure) {
        keep('failure', failure, FAILURE_SECONDS);
      }

      return this.redirect(ACCOUNT_PAGE);
    },

    answer(body: SessionState | Result<unknown>, status = 200) {
      headers.set('Content-Type', 'application/json; charset=utf-8');

      return new Response(JSON.stringify(body), { status, headers });
    },

    refuse(status: number, allow?: string) {
      if (allow) {
        headers.set('Allow', allow);
      }

      return new Response(null, { status, headers });
    },
  };
}

type Visit = ReturnType<typeof visit>;

/** What signing in gave, as the cookies of this browser keep it. */
export function accessOf(at: Visit): Access | null {
  const sessionId = at.cookie('session');
  const accessToken = at.cookie('access');
  const accountObjectId = at.cookie('accountObject');

  if (!sessionId) {
    return null;
  }

  return accessToken && accountObjectId
    ? { sessionId, accessToken, accountObjectId }
    : { sessionId };
}

/** Keeps (again, for another 180 days) what signing in gave. */
function keepAccess(at: Visit, access: Access) {
  at.keep('session', access.sessionId, SESSION_SECONDS);

  if (access.accessToken && access.accountObjectId) {
    at.keep('access', access.accessToken, SESSION_SECONDS);
    at.keep('accountObject', access.accountObjectId, SESSION_SECONDS);
  }
}

/** Forgets in this browser everything signing in gave. */
export function dropAccess(at: Visit) {
  at.drop('session');
  at.drop('access');
  at.drop('accountObject');
  at.drop('watchedList');
}

/**
 * Keeps the id of the list of watched titles in this browser, so the site
 * looks for it once. Not a secret: TMDB only shows the list to its owner.
 */
export function watchedListCache(at: Visit) {
  return {
    get: () => {
      const id = Number(at.cookie('watchedList'));

      return Number.isInteger(id) && id > 0 ? id : undefined;
    },
    set: (id: number | undefined) =>
      id === undefined
        ? at.drop('watchedList')
        : at.keep('watchedList', String(id), SESSION_SECONDS),
  };
}

/**
 * Signing in to TMDB on the web version of the app. A page has no safe
 * place for a session, so the site keeps it: in a cookie that the browser
 * sends back and that the scripts of the page cannot read. The page is only
 * told who signed in, like the window of the desktop app.
 *
 *   GET  /api/auth/login     to the approval page of the TMDB website
 *   GET  /api/auth/callback  where TMDB sends the browser afterwards
 *   GET  /api/auth/session   who is signed in, as a SessionState
 *   POST /api/auth/logout    ends the session, here and at TMDB
 */
export function createWebAuth(options: WebAuthOptions) {
  const credential = options.credential?.trim() || null;
  const tmdb = createTmdbClient({
    getCredential: () => credential,
    fetch: options.fetch ?? ((url, init) => fetch(url, init)),
    baseUrl: options.baseUrl,
    // A function has a few seconds to answer, and the callback asks twice.
    timeoutMs: 4000,
    retries: 0,
  });

  /** Ends at TMDB what signing in gave, when this site is not going to use it. */
  async function discard(ended: Access) {
    try {
      await tmdb.deleteSession(ended);
    } catch {
      // The browser forgets it either way, which is all the site can do.
    }
  }

  async function login(at: Visit) {
    const callback = `${at.origin}${AUTH_PATHS.callback}`;
    let requestToken: string;

    try {
      requestToken = await tmdb.createRequestToken(callback);
    } catch (error) {
      return at.toApp(loginFailure(error));
    }

    if (!VALUE.test(requestToken)) {
      return at.toApp('unavailable');
    }

    at.keep('login', requestToken, LOGIN_SECONDS);
    at.drop('failure');

    return at.redirect(
      authorizeUrl(requestToken, callback, options.website || undefined),
    );
  }

  // Anyone can open this address, with any parameters, so they decide
  // nothing: the token traded is the one of the cookie, which only the login
  // of this browser could set, and TMDB says whether it was approved. At
  // worst, a page that sends the browser here early ends a login that was
  // still waiting, as a refusal.
  async function callback(at: Visit, returned: string | null) {
    const requestToken = at.cookie('login');

    // TMDB v3 comes back with the request token in the address (v4 with
    // nothing). Another one is the way back of an older login, or a page
    // trying to end the login by guessing: the login that is waiting is
    // left alone.
    if (!requestToken || (returned !== null && returned !== requestToken)) {
      return at.toApp();
    }

    // A request token is traded once.
    at.drop('login');

    let given: Access;

    try {
      given = await tmdb.createSession(requestToken);
    } catch (error) {
      // TMDB only sends the browser back after the user answered, so a
      // token it refuses is one the user did not approve.
      return at.toApp(isSessionDenied(error) ? 'denied' : loginFailure(error));
    }

    if (
      ![given.sessionId, given.accessToken, given.accountObjectId].every(
        (value) => value === undefined || VALUE.test(value),
      )
    ) {
      await discard(given);

      return at.toApp('unavailable');
    }

    const previous = accessOf(at);

    if (previous && previous.sessionId !== given.sessionId) {
      await discard(previous);
    }

    keepAccess(at, given);
    at.drop('failure');

    // Signed in with a key (v3): nothing of a v4 login before it stays.
    if (!given.accessToken) {
      at.drop('access');
      at.drop('accountObject');
    }

    return at.toApp();
  }

  async function session(at: Visit) {
    const failure = at.cookie('failure');
    const kept = accessOf(at);

    // A login that failed is told once.
    if (failure) {
      at.drop('failure');
    }

    if (!kept) {
      return at.answer(
        failure && FAILURES.includes(failure)
          ? { status: 'error', reason: failure as LoginFailure }
          : ANONYMOUS,
      );
    }

    try {
      const account = await tmdb.account(kept.sessionId);

      keepAccess(at, kept);

      return at.answer({ status: 'authenticated', account });
    } catch (error) {
      if (isSessionOver(error)) {
        dropAccess(at);

        return at.answer(ANONYMOUS);
      }

      // TMDB could not be asked, which says nothing about the session: the
      // cookie stays for the next visit.
      return at.answer({ status: 'error', reason: loginFailure(error) }, 502);
    }
  }

  async function logout(at: Visit, origin: string | null) {
    // Browsers say where a POST comes from. SameSite already keeps the
    // cookie out of the ones other sites start, and this does not depend on
    // it: only the app itself signs anyone out.
    if (origin !== at.origin) {
      return at.refuse(403);
    }

    const ended = accessOf(at);

    dropAccess(at);
    at.drop('login');
    at.drop('failure');

    if (ended) {
      await discard(ended);
    }

    return at.answer(ANONYMOUS);
  }

  return async function handle(request: Request): Promise<Response> {
    const at = visit(request);
    const url = new URL(request.url);
    const reading = request.method === 'GET';

    switch (url.pathname) {
      case AUTH_PATHS.login:
        return reading ? login(at) : at.refuse(405, 'GET');

      case AUTH_PATHS.callback:
        return reading
          ? callback(at, url.searchParams.get('request_token'))
          : at.refuse(405, 'GET');

      case AUTH_PATHS.session:
        return reading ? session(at) : at.refuse(405, 'GET');

      case AUTH_PATHS.logout:
        return request.method === 'POST'
          ? logout(at, request.headers.get('origin'))
          : at.refuse(405, 'POST');

      default:
        return at.refuse(404);
    }
  };
}

export type WebAuth = ReturnType<typeof createWebAuth>;
