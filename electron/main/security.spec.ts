import { describe, expect, it } from 'vitest';
import { isAppUrl, isNativeTheme, isSafeExternalUrl } from './security';

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
