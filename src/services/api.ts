import type { MediaAppApi } from '@shared/api';
import { createWebApi } from './webApi';

let webApi: MediaAppApi | undefined;

/**
 * The renderer's only way to TMDB. In the desktop app it is the API that
 * the preload script exposes; as a web page, it is the same API over HTTP.
 */
export function getApi(): MediaAppApi {
  if (window.api) {
    return window.api;
  }

  // Inside Electron the preload script always runs. Falling back to the web
  // version there would only hide that something is broken.
  if (navigator.userAgent.includes('Electron')) {
    throw new Error(
      'window.api is missing: the preload script of the app did not run',
    );
  }

  webApi ??= createWebApi();

  return webApi;
}

/** False when the app runs as a web page instead of installed. */
export const isDesktop = () => getApi().platform === 'desktop';
