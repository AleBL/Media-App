import { APP_TOKEN } from '../support/fake-tmdb';
import { cards, openPage, searchBox } from '../support/fixtures';
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

  test('has no settings, and no place for a key of the user', async ({
    page,
    site,
  }) => {
    await page.goto(site.url);

    await expect(page.locator('header nav a[href$="#/search"]')).toBeVisible();
    await expect(page.locator('header nav a[href$="#/settings"]')).toHaveCount(
      0,
    );

    await page.goto(`${site.url}#/settings`);

    await expect(
      page.getByText('nothing to set up in the web version'),
    ).toBeVisible();
    await expect(page.locator('input')).toHaveCount(0);
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
