import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { installFakeApi } from '@/test/fakeApi';

const STORAGE_KEY = 'vueuse-color-scheme';

// theme.ts sets itself up when it is imported, so each test loads a fresh
// copy after preparing localStorage and window.api.
async function loadTheme() {
  vi.resetModules();
  return import('@/components/NavBar/theme');
}

describe('native theme sync', () => {
  let setNativeTheme: ReturnType<typeof installFakeApi>['setNativeTheme'];

  beforeEach(() => {
    localStorage.clear();
    setNativeTheme = installFakeApi().setNativeTheme;
  });

  afterEach(() => {
    delete window.api;
  });

  it('follows the operating system until a theme is chosen', async () => {
    await loadTheme();

    expect(setNativeTheme).toHaveBeenCalledWith('system');
  });

  it('applies a stored theme on startup', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark');

    await loadTheme();

    expect(setNativeTheme).toHaveBeenCalledWith('dark');
  });

  it('tells the main process when the theme is toggled', async () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const { ThemeItem } = await loadTheme();
    const theme = new ThemeItem((key: string) => key).getThemes() as {
      command: () => void;
    };

    theme.command();
    await nextTick();

    expect(setNativeTheme).toHaveBeenLastCalledWith('dark');
  });

  it('works without the preload api', async () => {
    delete window.api;

    await expect(loadTheme()).resolves.toBeDefined();
  });
});
