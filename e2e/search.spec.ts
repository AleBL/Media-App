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

  test('shows the results small, large or as a list, the same on other pages', async ({
    page,
  }) => {
    await searchBox(page).fill('matrix');
    await expect(cards(page)).toHaveCount(20);

    const first = cards(page).first();
    const width = async () => (await first.boundingBox())?.width ?? 0;
    const medium = await width();

    await page.getByRole('radio', { name: 'Small' }).check();
    await expect.poll(width).toBeLessThan(medium);
    // too small for the genres
    await expect(first).not.toContainText('Action');

    await page.getByRole('radio', { name: 'Large' }).check();
    await expect.poll(width).toBeGreaterThan(medium);

    // A list has the synopsis.
    await page.getByRole('radio', { name: 'List' }).check();
    await expect(first).toContainText('The story of title 1, told in en.');
    await expect(first).toContainText('Movie 1 [en]');

    await openPage(page, 'settings');
    await expect(page.getByRole('radio', { name: 'List' })).toBeChecked();
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

    await page.getByRole('radio', { name: 'All', exact: true }).check();

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

    // and their name to their page
    await page.goBack();
    await person.getByRole('link', { name: 'Person 3' }).click();
    await expect(page).toHaveURL(/#\/person\/1$/);
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

  test('finds the titles of a year, with more filters in Explore', async ({
    page,
    tmdb,
  }) => {
    await searchBox(page).fill('the office');
    await page.getByRole('radio', { name: 'TV Show' }).check();
    const year = page.getByRole('spinbutton', { name: 'Year of release' });
    await year.fill('2005');
    await year.press('Enter');

    await expect(page).toHaveURL(/#\/search\?q=the\+office&type=tv&year=2005$/);
    await expect
      .poll(() => tmdb.lastSearch())
      .toMatchObject({
        path: '/3/search/tv',
        query: 'the office',
        first_air_date_year: '2005',
      });

    await page.getByRole('link', { name: 'More filters' }).click();

    await expect(page).toHaveURL(/#\/discover\?type=tv&from=2005&to=2005$/);
    await expect(heading(page)).toHaveText('Explore');
    await expect
      .poll(() => tmdb.lastDiscovery())
      .toMatchObject({
        path: '/3/discover/tv',
        'first_air_date.gte': '2005-01-01',
        'first_air_date.lte': '2005-12-31',
      });
  });

  test('says so when nothing is found', async ({ page }) => {
    await searchBox(page).fill(QUERY_WITHOUT_RESULTS);

    await expect(page.getByText('No records found')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
  });
});
