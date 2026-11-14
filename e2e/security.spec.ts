import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { APP_TOKEN } from './support/fake-tmdb';
import { expect, openPage, projectRoot, test } from './support/fixtures';

test.describe('renderer isolation', () => {
  test('the page has no Node or Electron, only the preload api', async ({
    page,
  }) => {
    const seen = await page.evaluate(() => ({
      require: typeof (globalThis as { require?: unknown }).require,
      process: typeof (globalThis as { process?: unknown }).process,
      api: Object.keys(window.api ?? {}).sort(),
      credentials: Object.keys(window.api?.credentials ?? {}).sort(),
    }));

    expect(seen).toEqual({
      require: 'undefined',
      process: 'undefined',
      api: ['credentials', 'setNativeTheme', 'tmdb', 'versions'],
      // no way to read the key back
      credentials: ['clear', 'save', 'status'],
    });
  });

  test('the window is sandboxed and isolated', async ({ running }) => {
    const preferences = await running.app.evaluate(({ BrowserWindow }) => {
      // Not in Electron's type definitions, but it is the only way to read
      // the preferences a window was really created with.
      const contents = BrowserWindow.getAllWindows()[0]
        .webContents as unknown as {
        getLastWebPreferences(): Record<string, unknown>;
      };
      const { contextIsolation, nodeIntegration, sandbox } =
        contents.getLastWebPreferences();

      return { contextIsolation, nodeIntegration, sandbox };
    });

    expect(preferences).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
  });

  test('the window never leaves the app', async ({ running }) => {
    const { app, page, openedInBrowser } = running;
    await openPage(page, 'about');

    await page
      .evaluate(() => {
        location.href = 'https://example.com/';
      })
      .catch(() => {});

    await expect.poll(openedInBrowser).toEqual(['https://example.com/']);
    // Asked from the main process: Playwright loses track of a page whose
    // navigation was cancelled.
    const stillThere = await app.evaluate(async ({ BrowserWindow }) => {
      const { webContents } = BrowserWindow.getAllWindows()[0];

      return {
        url: webContents.getURL(),
        logos: await webContents.executeJavaScript(
          `document.querySelectorAll('img.logo').length`,
        ),
      };
    });

    expect(stillThere.url).toMatch(/index\.html#\/about$/);
    expect(stillThere.logos).toBeGreaterThan(0);
  });

  test('links to other sites go to the browser, without a new window', async ({
    running,
  }) => {
    const { app, page, openedInBrowser } = running;
    await openPage(page, 'about');

    await page.locator('a[target="_blank"]').first().click();

    await expect.poll(openedInBrowser).toEqual(['https://www.electronjs.org/']);
    expect(app.windows()).toHaveLength(1);
  });

  test('only https pages are handed to the browser', async ({ running }) => {
    const { page, openedInBrowser } = running;

    await page.evaluate(() => {
      window.open('http://insecure.example/');
      window.open('file:///etc/passwd');
      window.open('https://www.themoviedb.org/');
    });

    await expect.poll(openedInBrowser).toEqual(['https://www.themoviedb.org/']);
  });

  test('permission requests are denied', async ({ page }) => {
    const answer = await page.evaluate(
      () =>
        new Promise<string>((resolve) =>
          navigator.geolocation.getCurrentPosition(
            () => resolve('granted'),
            () => resolve('denied'),
            { timeout: 3000 },
          ),
        ),
    );

    expect(answer).toBe('denied');
  });

  test('the credential of the app stays in the main process', async ({
    page,
  }) => {
    const holds = async (file: string) =>
      (await readFile(file)).includes(APP_TOKEN);
    const built = (path: string) => join(projectRoot, path);

    // The app under test really carries the credential...
    expect(await holds(built('dist-electron/main/index.js'))).toBe(true);
    // ...but nothing that the window loads does.
    expect(await holds(built('dist-electron/preload/index.js'))).toBe(false);

    const rendererFiles = (
      await readdir(built('dist'), { recursive: true, withFileTypes: true })
    ).filter((entry) => entry.isFile());

    expect(rendererFiles.length).toBeGreaterThan(0);

    for (const entry of rendererFiles) {
      const file = join(entry.parentPath, entry.name);

      expect(await holds(file), file).toBe(false);
    }

    // And the page has no way to get it at run time.
    const seen = await page.evaluate(async () =>
      JSON.stringify([
        await window.api?.credentials.status(),
        { ...localStorage },
        document.documentElement.outerHTML,
      ]),
    );

    expect(seen).not.toContain(APP_TOKEN);
  });

  test('the page makes no request to TMDB by itself', async ({ page }) => {
    const blocked = await page.evaluate(() =>
      fetch('https://api.themoviedb.org/3/configuration').then(
        () => false,
        () => true,
      ),
    );

    expect(blocked).toBe(true);
  });
});
