import type { MediaAppApi } from '@shared/api';

/**
 * The API exposed by the preload script. The renderer has no other way to
 * reach TMDB or the main process, so its absence is an error.
 */
export function getApi(): MediaAppApi {
  if (!window.api) {
    throw new Error(
      'window.api is missing: the app must run in Electron with its preload script',
    );
  }

  return window.api;
}
