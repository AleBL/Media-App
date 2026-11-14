import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApi, isDesktop } from '@/services/api';
import { installFakeApi } from '@/test/fakeApi';

describe('getApi', () => {
  afterEach(() => {
    delete window.api;
    vi.unstubAllGlobals();
  });

  it('is the api of the preload script in the desktop app', () => {
    const api = installFakeApi();

    expect(getApi()).toBe(api);
    expect(isDesktop()).toBe(true);
  });

  it('is the web api when the app runs as a web page', () => {
    expect(getApi().platform).toBe('web');
    expect(isDesktop()).toBe(false);
    // one instance, like window.api
    expect(getApi()).toBe(getApi());
  });

  it('does not pass for a web page inside Electron, where the preload script must have run', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 Chrome/156.0.0.0 Electron/45.0.0 Safari/537.36',
    });

    expect(() => getApi()).toThrow('preload script');
  });
});
