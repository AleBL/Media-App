import type { TmdbErrorCode } from '@shared/api';

/** A request that failed because of the TMDB credential, not of itself. */
export type AccessProblem =
  /** The app has no credential and the user saved no key. */
  | 'noAccess'
  /** TMDB refused the credential of the app. */
  | 'appRefused'
  /** TMDB refused the key the user saved. */
  | 'ownKeyRefused'
  /** On the web: only whoever runs the site can solve it. */
  | 'webUnavailable';

/**
 * Why a request failed, when the credential is the reason. In the desktop
 * app the settings page can solve it; on the web there is nothing the
 * visitor can do.
 */
export function accessProblem(
  code: TmdbErrorCode | undefined,
  desktop: boolean,
  hasKey: boolean,
): AccessProblem | null {
  if (code !== 'missing-credential' && code !== 'unauthorized') {
    return null;
  }

  if (!desktop) {
    return 'webUnavailable';
  }

  if (code === 'missing-credential') {
    return 'noAccess';
  }

  return hasKey ? 'ownKeyRefused' : 'appRefused';
}
