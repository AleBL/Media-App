import type { LoginFailure } from '../api';
import { isV4RequestToken, TmdbError } from './client';

// What signing in to TMDB has in common wherever the app runs: in the
// desktop app (electron/main/auth/service.ts) and on the site of the web
// version (web-auth.ts).

/** The TMDB website, where the user approves a request token. */
export const TMDB_WEBSITE = 'https://www.themoviedb.org';

// TMDB's own `status_code` of the answers that mean something here.
// The session does not exist: it was ended, in the app or on the website.
const SESSION_OVER = 3;
// The request token cannot be traded: it was not approved (not yet, or
// because the user refused) or it was already traded. 17 in v3, 41 in v4.
const SESSION_DENIED = [17, 41];

/**
 * The page where the user approves `requestToken`. A v4 token already says
 * where TMDB sends the browser afterwards; a v3 one is told here, with
 * `redirectTo`, when there is one. Another `website` is for tests.
 */
export function authorizeUrl(
  requestToken: string,
  redirectTo?: string,
  website = TMDB_WEBSITE,
) {
  if (isV4RequestToken(requestToken)) {
    const url = new URL(`${website}/auth/access`);

    url.searchParams.set('request_token', requestToken);

    return url.toString();
  }

  const url = new URL(
    `${website}/authenticate/${encodeURIComponent(requestToken)}`,
  );

  if (redirectTo) {
    url.searchParams.set('redirect_to', redirectTo);
  }

  return url.toString();
}

/** TMDB will not trade the request token: it is not approved. */
export function isSessionDenied(error: unknown) {
  return (
    error instanceof TmdbError &&
    error.tmdbStatus !== undefined &&
    SESSION_DENIED.includes(error.tmdbStatus)
  );
}

/**
 * TMDB no longer knows the session. A credential of the app that TMDB
 * refuses is also a 401, and says nothing about the session.
 */
export function isSessionOver(error: unknown) {
  return (
    error instanceof TmdbError &&
    error.status === 401 &&
    error.tmdbStatus === SESSION_OVER
  );
}

/** A failure that says nothing about the login: asking again may work. */
export function isTemporary(error: unknown) {
  return (
    error instanceof TmdbError &&
    ['network', 'timeout', 'rate-limited', 'server'].includes(error.code)
  );
}

/** What the user is told about a failure that is not a refusal. */
export const loginFailure = (error: unknown): LoginFailure =>
  isTemporary(error) ? 'network' : 'unavailable';
