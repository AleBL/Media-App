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

export function isNativeTheme(value: unknown): value is NativeTheme {
  return value === 'system' || value === 'light' || value === 'dark';
}
