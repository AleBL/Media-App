import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  allowsPermission,
  APP_REFERER,
  isAppUrl,
  isNativeTheme,
  isSafeExternalUrl,
  isTrailerUrl,
  withAppReferer,
} from './security';

describe('the player of a trailer', () => {
  it('is the player of YouTube without cookies, and nothing else', () => {
    expect(
      isTrailerUrl(
        'https://www.youtube-nocookie.com/embed/vKQi3bBA1y8?autoplay=1',
      ),
    ).toBe(true);
    expect(isTrailerUrl('https://www.youtube-nocookie.com/')).toBe(false);
    expect(isTrailerUrl('https://www.youtube.com/embed/vKQi3bBA1y8')).toBe(
      false,
    );
    expect(isTrailerUrl('http://www.youtube-nocookie.com/embed/x')).toBe(false);
    expect(isTrailerUrl('not a url')).toBe(false);
  });

  it('may go full screen, as nothing else may, and ask for nothing more', () => {
    const player = 'https://www.youtube-nocookie.com/embed/vKQi3bBA1y8';

    expect(allowsPermission('fullscreen', player)).toBe(true);
    expect(allowsPermission('fullscreen', 'file:///app/index.html')).toBe(
      false,
    );
    expect(allowsPermission('fullscreen', undefined)).toBe(false);
    expect(allowsPermission('media', player)).toBe(false);
    expect(allowsPermission('notifications', player)).toBe(false);
  });

  it('is told who embeds it by the id of the app', () => {
    // The tests run from the root of the project.
    const config = readFileSync('electron-builder.json5', 'utf8');
    const appId = /appId:\s*'([^']+)'/.exec(config)?.[1];

    expect(APP_REFERER).toBe(`https://${appId}`);
    // over whatever the page said, which from file:// is nothing
    expect(
      withAppReferer({ Accept: 'text/html', Referer: 'file:///' }),
    ).toEqual({ Accept: 'text/html', Referer: APP_REFERER });
  });
});

describe('isSafeExternalUrl', () => {
  it('accepts https pages', () => {
    expect(isSafeExternalUrl('https://www.themoviedb.org/movie/603')).toBe(
      true,
    );
  });

  it.each([
    'http://example.com/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'smb://server/share',
    'not a url',
    '',
  ])('rejects %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(false);
  });
});

describe('isAppUrl', () => {
  const built = { indexHtml: '/opt/media-app/dist/index.html' };
  const dev = { ...built, devServerUrl: 'http://localhost:5173/' };

  it('accepts the built index.html with any route', () => {
    expect(isAppUrl('file:///opt/media-app/dist/index.html', built)).toBe(true);
    expect(
      isAppUrl('file:///opt/media-app/dist/index.html#/search', built),
    ).toBe(true);
  });

  it('rejects other files and remote pages in the built app', () => {
    expect(isAppUrl('file:///etc/passwd', built)).toBe(false);
    expect(isAppUrl('file:///opt/media-app/dist/other.html', built)).toBe(
      false,
    );
    expect(isAppUrl('https://example.com/', built)).toBe(false);
    expect(isAppUrl('http://localhost:5173/', built)).toBe(false);
  });

  it('accepts only the dev server origin while developing', () => {
    expect(isAppUrl('http://localhost:5173/#/about', dev)).toBe(true);
    expect(isAppUrl('http://localhost:5174/', dev)).toBe(false);
    expect(isAppUrl('https://localhost:5173/', dev)).toBe(false);
    expect(isAppUrl('file:///opt/media-app/dist/index.html', dev)).toBe(false);
  });

  it('rejects malformed urls', () => {
    expect(isAppUrl('not a url', built)).toBe(false);
    expect(isAppUrl('', dev)).toBe(false);
  });
});

describe('isNativeTheme', () => {
  it('accepts the three theme sources', () => {
    expect(['system', 'light', 'dark'].every(isNativeTheme)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isNativeTheme('auto')).toBe(false);
    expect(isNativeTheme(undefined)).toBe(false);
    expect(isNativeTheme({ theme: 'dark' })).toBe(false);
  });
});
