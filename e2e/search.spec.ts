import { QUERY_WITHOUT_RESULTS } from './support/fake-tmdb';
import {
  cards,
  chooseLanguage,
  expect,
  heading,
  openPage,
  searchBox,
  test,
} from './support/fixtures';

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
    await expect(cards(page).first()).toContainText('7.5');
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

  test('adds more results at the end, up to the last', async ({
    page,
    tmdb,
  }) => {
    await searchBox(page).fill('matrix');
    await expect(cards(page)).toHaveCount(20);

    // Getting near the end asks for the next page by itself.
    await cards(page).last().scrollIntoViewIfNeeded();
    await expect(cards(page)).toHaveCount(40);
    expect(tmdb.lastSearch()?.page).toBe('2');

    // The button does the same.
    await page.getByRole('button', { name: 'Show more' }).click();
    await expect(cards(page)).toHaveCount(45);
    expect(tmdb.lastSearch()?.page).toBe('3');
    await expect(cards(page).last()).toContainText('Movie 45');
    await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(
      0,
    );
  });

  test('keeps the search in the address', async ({ page }) => {
    await searchBox(page).fill('matrix');
    await page.getByRole('radio', { name: 'TV Show' }).check();

    await expect(page).toHaveURL(/#\/search\?q=matrix&type=tv$/);

    await page.reload();

    await expect(searchBox(page)).toHaveValue('matrix');
    await expect(page.getByRole('radio', { name: 'TV Show' })).toBeChecked();
    await expect(cards(page).first()).toContainText('Show 1');
  });

  test('searches tv shows', async ({ page, tmdb }) => {
    await searchBox(page).fill('breaking');
    await expect(cards(page).first()).toContainText('Movie 1');

    await page.getByRole('radio', { name: 'TV Show' }).check();

    await expect(cards(page).first()).toContainText('Show 1 [en] (2008)');
    await expect(cards(page).first()).toContainText('Drama');
    expect(tmdb.lastSearch()?.path).toBe('/3/search/tv');
  });

  test('searches movies, tv shows and people at once', async ({
    page,
    tmdb,
  }) => {
    await searchBox(page).fill('keanu');
    await expect(cards(page).first()).toContainText('Movie 1');

    await page.getByRole('radio', { name: 'All' }).check();

    await expect(cards(page)).toHaveCount(20);
    await expect(cards(page).nth(1)).toContainText('TV Show');
    await expect(cards(page).nth(1)).toContainText('Show 2 [en] (2008)');

    // the person has the id of the first movie, and both are shown
    const person = cards(page).nth(2);
    await expect(person).toContainText('Person 3');
    await expect(person).toContainText('Known for');
    await expect(cards(page).first()).toContainText('Movie 1 [en] (2020)');
    expect(tmdb.lastSearch()).toEqual({
      path: '/3/search/multi',
      credential: 'app',
      query: 'keanu',
      page: '1',
      language: 'en',
      include_adult: 'false',
    });

    await person.getByRole('link', { name: 'Show 2 [en] (2008)' }).click();

    await expect(page).toHaveURL(/#\/tv\/9002$/);
    await expect(heading(page)).toHaveText('Show 2 [en] (2008)');
  });

  test('follows the language chosen in the menu', async ({ page, tmdb }) => {
    await searchBox(page).fill('matrix');
    await expect(cards(page).first()).toContainText('Movie 1 [en]');

    await chooseLanguage(page, 'Português (Brasil)');

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
