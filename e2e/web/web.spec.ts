import type { Page } from '@playwright/test';
import { APP_TOKEN, TRAILER_KEY } from '../support/fake-tmdb';
import { cards, heading, openPage, searchBox } from '../support/fixtures';
import { expect, test } from './fixtures';

// The same interface as a web page, in a browser: no Electron, no preload
// script. TMDB is reached through the site (api/tmdb.ts on Vercel).
test.describe('web version', () => {
  test('searches without any setup, through the site', async ({
    page,
    site,
    tmdb,
    received,
  }) => {
    await page.goto(site.url);
    await page.getByRole('link', { name: 'Start searching' }).click();
    await searchBox(page).fill('tom & jerry');

    await expect(cards(page)).toHaveCount(20);
    await expect(cards(page).first()).toContainText('Movie 1 [en] (2020)');
    await expect(cards(page).first()).toContainText('Action');
    expect(tmdb.lastSearch()).toEqual({
      path: '/3/search/movie',
      credential: 'app',
      query: 'tom & jerry',
      page: '1',
      language: 'en',
      include_adult: 'false',
    });

    // The browser only ever talked to the site.
    for (const address of received.keys()) {
      expect(address.startsWith(site.url), address).toBe(true);
    }
  });

  test('walks through the pages and follows the language', async ({
    page,
    site,
    tmdb,
  }) => {
    await page.goto(site.url);
    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await expect(cards(page)).toHaveCount(20);

    await page.locator('.paginator-pages button').nth(2).click();

    await expect(cards(page)).toHaveCount(5);
    expect(tmdb.lastSearch()?.page).toBe('3');

    await page.locator('header button:has(.pi-language)').click();
    await page.getByText('pt-BR', { exact: true }).click();

    await expect(cards(page).first()).toContainText('[pt-BR]');
    await expect(cards(page).first()).toContainText('Ação');
    expect(tmdb.lastSearch()?.language).toBe('pt-BR');
  });

  test('searches everything, people too, through the site', async ({
    page,
    site,
    tmdb,
  }) => {
    await page.goto(site.url);
    await openPage(page, 'search');
    await page.getByRole('radio', { name: 'All' }).check();
    await searchBox(page).fill('keanu');

    await expect(cards(page)).toHaveCount(20);
    await expect(cards(page).nth(2)).toContainText('Person 3');
    expect(tmdb.lastSearch()).toMatchObject({
      path: '/3/search/multi',
      credential: 'app',
      query: 'keanu',
    });

    await cards(page)
      .nth(2)
      .getByRole('link', { name: 'Movie 1 [en] (2020)' })
      .click();

    await expect(heading(page)).toHaveText('Movie 1 [en] (2020)');
  });

  test('shows the lists of the home page, through the site', async ({
    page,
    site,
    tmdb,
  }) => {
    await page.goto(site.url);

    const trending = page.getByRole('region', { name: 'Trending this week' });

    await expect(trending.getByRole('link')).toHaveText([
      'Movie 1 [en]',
      'Show 1 [en]',
      'Movie 2 [en]',
    ]);
    await expect(
      page.getByRole('region', { name: 'Popular TV shows' }),
    ).toContainText('Show 11 [en]');
    expect(tmdb.lists().every(({ credential }) => credential === 'app')).toBe(
      true,
    );

    await trending.getByRole('link', { name: 'Movie 2 [en]' }).click();

    await expect(heading(page)).toHaveText('Movie 2 [en] (2020)');
  });

  test.describe('the page of a title', () => {
    // The region for where to watch comes from the languages of the browser.
    test.use({ locale: 'en-US' });

    test('opens through the site, and goes back to the results', async ({
      page,
      site,
      tmdb,
      received,
    }) => {
      await page.goto(site.url);
      await openPage(page, 'search');
      await searchBox(page).fill('matrix');
      await cards(page).first().getByRole('link').click();

      await expect(heading(page)).toHaveText('Movie 1 [en] (2020)');
      await expect(
        page.getByRole('heading', { name: 'Where to watch in United States' }),
      ).toBeVisible();
      await expect(page.getByText('Stream US')).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Watch the trailer' }),
      ).toHaveAttribute(
        'href',
        `https://www.youtube.com/watch?v=${TRAILER_KEY}`,
      );
      expect(tmdb.pages().at(-1)).toMatchObject({
        path: '/3/movie/1',
        credential: 'app',
        language: 'en',
      });

      await page.getByRole('button', { name: 'Back' }).click();

      await expect(cards(page)).toHaveCount(20);
      for (const address of received.keys()) {
        expect(address.startsWith(site.url), address).toBe(true);
      }
    });
  });

  test('the credential of the site never reaches the browser', async ({
    page,
    site,
    received,
  }) => {
    await page.goto(site.url);
    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await expect(cards(page)).toHaveCount(20);

    const seen = await page.evaluate(() =>
      JSON.stringify([
        { ...localStorage },
        document.cookie,
        document.documentElement.outerHTML,
      ]),
    );

    expect(seen).not.toContain(APP_TOKEN);
    expect(received.size).toBeGreaterThan(3);

    for (const [address, body] of received) {
      expect(body.includes(APP_TOKEN), address).toBe(false);
    }
  });

  test('has settings, with no place for a key of the user', async ({
    page,
    site,
  }) => {
    await page.goto(site.url);
    await openPage(page, 'settings');

    await expect(page.getByLabel('Country')).toBeVisible();
    await expect(page.getByLabel('TMDB key', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Clear cache' })).toHaveCount(
      0,
    );
  });

  test('names TMDB as the source on the about page', async ({ page, site }) => {
    await page.goto(site.url);
    await openPage(page, 'about');

    const tmdb = page.getByRole('region', {
      name: 'Where the data comes from',
    });

    await expect(tmdb).toContainText(
      'is not endorsed, certified, or otherwise approved by TMDB.',
    );
    await expect
      .poll(() =>
        tmdb
          .getByRole('img', { name: 'The Movie Database (TMDB)' })
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
  });

  test('fits the tools of the about page on a phone', async ({
    page,
    site,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.url}#/about`);

    const versions = page.locator('.waviy');

    await expect(versions).toHaveCount(9);

    // Each version stays on one line, beside its logo.
    for (const version of await versions.all()) {
      const lines = await version.evaluate(
        (element) =>
          new Set(
            Array.from(
              element.children,
              (character) => (character as HTMLElement).offsetTop,
            ),
          ).size,
      );

      expect(lines).toBe(1);
    }

    // And nothing pushes the page sideways.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });

  test('folds the menu behind a button until it fits in one row', async ({
    page,
    site,
  }) => {
    // Spanish and the dark theme have the longest labels.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.setItem('locale', 'es'));
    await page.setViewportSize({ width: 1023, height: 800 });
    await page.goto(site.url);

    const toggle = page.getByRole('button', { name: 'Menú' });
    const menu = page.locator('#main-menu');

    await expect(toggle).toBeVisible();
    await expect(menu).toBeHidden();

    await toggle.click();
    await expect(menu).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 800 });

    // The bar keeps its height: its items did not wrap to a second row.
    await expect(toggle).toBeHidden();
    expect((await page.locator('header nav').boundingBox())?.height).toBe(64);
  });

  test('keeps the dark theme down to the end of a long page', async ({
    page,
    site,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.url}#/about`);
    await expect(page.locator('html')).toHaveClass(/dark/);

    // What shows past the app, as below the margin of its last element,
    // has the color of the app.
    const [app, body] = await page.evaluate(() =>
      [document.getElementById('app')!, document.body].map(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    );

    expect(body).toBe(app);
  });

  test('shows where to watch in the country chosen in the settings', async ({
    page,
    site,
  }) => {
    await page.goto(site.url);
    await openPage(page, 'settings');
    await page.getByLabel('Country').selectOption({ label: 'Brazil' });

    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await cards(page).first().getByRole('link').click();

    await expect(
      page.getByRole('heading', { name: 'Where to watch in Brazil' }),
    ).toBeVisible();
  });

  test('drops the key that the old web version kept in the browser', async ({
    page,
    site,
    tmdb,
  }) => {
    await page.goto(site.url);
    await page.evaluate(() =>
      localStorage.setItem('api_key', '0123456789abcdef0123456789abcdef'),
    );
    await page.reload();

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('api_key')))
      .toBeNull();

    await openPage(page, 'search');
    await searchBox(page).fill('matrix');

    await expect(cards(page)).toHaveCount(20);
    expect(tmdb.lastSearch()?.credential).toBe('app');
  });

  test('shows the shape of the lists while TMDB answers', async ({
    page,
    site,
  }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    await page.route('**/api/tmdb**', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(site.url);

    const trending = page.getByRole('region', { name: 'Trending this week' });

    await expect(trending.getByRole('status')).toHaveText('Loading...');
    await expect(trending.locator('.animate-pulse').first()).toBeVisible();

    release();

    await expect(trending.getByRole('article').first()).toBeVisible();
    await expect(trending.getByRole('status')).toHaveCount(0);
  });

  test.describe('the loading screen', () => {
    // Holds the code of the app, to see what shows before it starts.
    async function holdTheApp(page: Page) {
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });

      await page.route('**/assets/index-*.js', async (route) => {
        await held;
        await route.continue();
      });

      return release;
    }

    const background = (page: Page) =>
      page
        .locator('#app')
        .evaluate((app) => getComputedStyle(app).backgroundColor);

    test('shows until the app starts, in the dark theme from the start', async ({
      page,
      site,
    }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      const release = await holdTheApp(page);

      await page.goto(site.url, { waitUntil: 'commit' });

      await expect(page.getByRole('status')).toContainText('Loading Media App');
      await expect(page.locator('html')).toHaveClass(/dark/);
      // Neither white nor transparent once the stylesheet applies.
      await expect
        .poll(() => background(page))
        .not.toMatch(/^rgba?\((255, 255, 255|0, 0, 0, 0)\)$/);
      const dark = await background(page);

      release();

      await expect(
        page.getByRole('navigation', { name: 'Main menu' }),
      ).toBeVisible();
      await expect(page.getByText('Loading Media App')).toHaveCount(0);
      expect(await background(page)).toBe(dark);
    });

    test('follows the theme chosen in the app over the one of the system', async ({
      page,
      site,
    }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.addInitScript(() =>
        localStorage.setItem('vueuse-color-scheme', 'light'),
      );
      const release = await holdTheApp(page);

      await page.goto(site.url, { waitUntil: 'commit' });

      await expect(page.getByRole('status')).toContainText('Loading Media App');
      await expect(page.locator('html')).not.toHaveClass(/dark/);

      release();
    });
  });

  test('keeps to the Content-Security-Policy on every page', async ({
    page,
    site,
  }) => {
    // Before the page, so nothing it does is missed.
    await page.addInitScript(() => {
      const refused: string[] = [];

      Object.assign(window, { refusedByPolicy: refused });
      document.addEventListener('securitypolicyviolation', (event) => {
        refused.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
    });

    await page.goto(site.url);
    await expect(cards(page).first()).toBeVisible();
    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await cards(page).first().getByRole('link').click();
    await expect(heading(page)).toBeVisible();
    for (const name of ['settings', 'about', 'account'] as const) {
      await openPage(page, name);
    }
    // Changing the theme too, which once added a <style> element.
    await page.getByRole('button', { name: /^Theme/ }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    expect(
      await page.evaluate(
        () =>
          (window as unknown as { refusedByPolicy: string[] }).refusedByPolicy,
      ),
    ).toEqual([]);
  });

  test.describe('on a site without a credential', () => {
    test.use({ siteCredential: '' });

    test('says the search is unavailable, without asking TMDB', async ({
      page,
      site,
      tmdb,
    }) => {
      await page.goto(site.url);
      await openPage(page, 'search');
      await searchBox(page).fill('matrix');

      const alert = page.getByRole('alert');
      await expect(alert).toContainText(
        'The search is unavailable at the moment.',
      );
      await expect(alert.getByRole('link')).toHaveCount(0);
      await expect(cards(page)).toHaveCount(0);
      expect(tmdb.requests).toHaveLength(0);
    });
  });
});
