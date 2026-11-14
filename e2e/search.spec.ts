import { QUERY_WITHOUT_RESULTS } from './support/fake-tmdb';
import { cards, expect, openPage, searchBox, test } from './support/fixtures';

// Nothing is set up first: the app searches with its own credential.
test.describe('search', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, 'search');
  });

  test('finds movies and shows their details', async ({ page, tmdb }) => {
    await searchBox(page).fill('tom & jerry');

    await expect(cards(page)).toHaveCount(20);
    await expect(cards(page).first()).toContainText('Movie 1 [en] (2020)');
    await expect(cards(page).first()).toContainText('Action');
    await expect(cards(page).first()).toContainText('7.50');
    expect(tmdb.lastSearch()).toEqual({
      path: '/3/search/movie',
      credential: 'app',
      query: 'tom & jerry',
      page: '1',
      language: 'en',
      include_adult: 'false',
    });
  });

  test('asks once for a query typed key by key', async ({ page, tmdb }) => {
    await searchBox(page).pressSequentially('matrix', { delay: 40 });

    await expect(cards(page)).toHaveCount(20);
    expect(tmdb.searches()).toHaveLength(1);
    expect(tmdb.lastSearch()?.query).toBe('matrix');
  });

  test('walks through the pages of a result', async ({ page, tmdb }) => {
    await searchBox(page).fill('matrix');
    await expect(cards(page)).toHaveCount(20);

    const pages = page.locator('[data-pc-section="pagebutton"]');
    await expect(pages).toHaveText(['1', '2', '3']);

    await pages.nth(2).click();

    await expect(cards(page)).toHaveCount(5);
    await expect(cards(page).first()).toContainText('Movie 41');
    expect(tmdb.lastSearch()?.page).toBe('3');
  });

  test('searches tv shows', async ({ page, tmdb }) => {
    await searchBox(page).fill('breaking');
    await expect(cards(page).first()).toContainText('Movie 1');

    await page.getByText('TV Show', { exact: true }).click();

    await expect(cards(page).first()).toContainText('Show 1 [en] (2008)');
    await expect(cards(page).first()).toContainText('Drama');
    expect(tmdb.lastSearch()?.path).toBe('/3/search/tv');
  });

  test('follows the language chosen in the menu', async ({ page, tmdb }) => {
    await searchBox(page).fill('matrix');
    await expect(cards(page).first()).toContainText('Movie 1 [en]');

    await page
      .locator('[data-pc-section="menuitem"]:has(.pi-language)')
      .click();
    await page.getByText('pt-BR', { exact: true }).click();

    await expect(cards(page).first()).toContainText('Movie 1 [pt-BR]');
    await expect(cards(page).first()).toContainText('Ação');
    await expect(page.getByText('Filme', { exact: true })).toBeVisible();
    expect(tmdb.lastSearch()?.language).toBe('pt-BR');
  });

  test('says so when nothing is found', async ({ page }) => {
    await searchBox(page).fill(QUERY_WITHOUT_RESULTS);

    await expect(page.getByText('No records found')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
  });
});
