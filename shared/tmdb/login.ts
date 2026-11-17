import type { LoginFailure } from '../api';
import { isJwt, TmdbError } from './client';

// Sign-in helpers shared by the desktop app (electron/main/auth/service.ts)
// and the site (web-auth.ts).

export const TMDB_WEBSITE = 'https://www.themoviedb.org';

// TMDB `status_code` values.
const SESSION_NOT_FOUND = 3;
// Request token not approved (yet, or refused) or already used: 17 in v3, 41 in v4.
const TOKEN_NOT_APPROVED = [17, 41];

/**
 * The page where the user approves `requestToken`. A v4 token already knows
 * where to return; a v3 one takes `redirectTo` here. `website` is for tests.
 */
export function authorizeUrl(
  requestToken: string,
  redirectTo?: string,
  website = TMDB_WEBSITE,
) {
  if (isJwt(requestToken)) {
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

export function isTokenNotApproved(error: unknown) {
  return (
    error instanceof TmdbError &&
    error.tmdbStatus !== undefined &&
    TOKEN_NOT_APPROVED.includes(error.tmdbStatus)
  );
}

/**
 * The session was ended (in the app or on the website). A refused app
 * credential is also a 401, so the TMDB status code decides.
 */
export function isSessionExpired(error: unknown) {
  return (
    error instanceof TmdbError &&
    error.status === 401 &&
    error.tmdbStatus === SESSION_NOT_FOUND
  );
}

/** Says nothing about the login: trying again may work. */
export function isTemporaryError(error: unknown) {
  return (
    error instanceof TmdbError &&
    ['network', 'timeout', 'rate-limited', 'server'].includes(error.code)
  );
}

export const toLoginFailure = (error: unknown): LoginFailure =>
  isTemporaryError(error) ? 'network' : 'unavailable';
