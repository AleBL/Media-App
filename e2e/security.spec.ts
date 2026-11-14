import { expect, openPage, test } from './support/fixtures';

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
