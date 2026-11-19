import { pathToFileURL } from 'node:url';
import type { NativeTheme } from '../../shared/api';

/** Where the app itself is served from: the dev server or the built file. */
export type AppLocation = {
  devServerUrl?: string;
  indexHtml: string;
};

/** Only https pages may be handed to the system browser. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** True when `url` is the app itself and not some other page. */
export function isAppUrl(url: string, location: AppLocation): boolean {
  let target: URL;

  try {
    target = new URL(url);
  } catch {
    return false;
  }

  if (location.devServerUrl) {
    return target.origin === new URL(location.devServerUrl).origin;
  }

  return (
    target.protocol === 'file:' &&
    target.pathname === pathToFileURL(location.indexHtml).pathname
  );
}

/** Where the player of the trailers comes from: YouTube, without its
 * cookies until a video plays. */
export const TRAILER_ORIGIN = 'https://www.youtube-nocookie.com';

/**
 * Who the app is, for YouTube. Its player answers "Error 153" to a page that
 * does not say where it is embedded, and a page loaded from file:// says
 * nothing; YouTube asks an app for https:// and its app id, the appId of
 * electron-builder.json5.
 */
export const APP_REFERER = 'https://io.github.alebl.moviledger';

/** The headers of a request for the player, saying who the app is. */
export function withAppReferer(
  headers: Record<string, string>,
): Record<string, string> {
  return { ...headers, Referer: APP_REFERER };
}

/** True for the player of a trailer, the only page the app shows in a frame. */
export function isTrailerUrl(url: string): boolean {
  try {
    const target = new URL(url);

    return (
      target.origin === TRAILER_ORIGIN && target.pathname.startsWith('/embed/')
    );
  } catch {
    return false;
  }
}

/** The one permission the app gives: full screen, to the player of a
 * trailer. */
export function allowsPermission(
  permission: string,
  requestingUrl: string | undefined,
): boolean {
  return (
    permission === 'fullscreen' &&
    requestingUrl !== undefined &&
    isTrailerUrl(requestingUrl)
  );
}

export function isNativeTheme(value: unknown): value is NativeTheme {
  return value === 'system' || value === 'light' || value === 'dark';
}
