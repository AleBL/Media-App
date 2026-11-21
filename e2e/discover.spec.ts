import { GENRE_WITHOUT_TITLES } from './support/fake-tmdb';
import {
  cards,
  chooseCountry,
  chooseLanguage,
  expect,
  heading,
  openPage,
  test,
} from './support/fixtures';

// The Explore page: TMDB's discovery, with the filters beside the titles
// (the window is wide) and in the address.
test.describe('explore', () => {
  test('filters the titles, kept in the address, and comes back to the same place', async ({
    page,
    tmdb,
  }) => {
    await openPage(page, 'discover');

    await expect(heading(page)).toHaveText('Explore');
    await expect(cards(page)).toHaveCount(20);
    await expect(cards(page).first()).toContainText('Movie 1 [en] (2020)');
    expect(tmdb.lastDiscovery()).toMatchObject({
      path: '/3/discover/movie',
      credential: 'app',
      page: '1',
      language: 'en',
      include_adult: 'false',
      sort_by: 'popularity.desc',
    });

    const filters = page.getByRole('complementary', { name: 'Filters' });
    await filters.getByRole('checkbox', { name: 'Comedy' }).check();
    await page.getByRole('radio', { name: 'Best rated' }).check();

    await expect(page).toHaveURL(/#\/discover\?sort=rating&genres=35$/);
    await expect
      .poll(() => tmdb.lastDiscovery())
      .toMatchObject({
        with_genres: '35',
        sort_by: 'vote_average.desc',
        // a title rated by a few people does not come first
        'vote_count.gte': '300',
      });
    await expect(filters.getByRole('heading', { level: 2 })).toHaveText(
      'Filters (1)',
    );

    // more titles at the end, and back to them from one of them
    await cards(page).last().scrollIntoViewIfNeeded();
    await expect(cards(page)).toHaveCount(40);
    // Coming back, the titles are those already there: only the next
    // page may come, the scroll being near the end.
    const firstPages = () =>
      tmdb.discoveries().filter((asked) => asked.page === '1').length;
    const asked = firstPages();
    await cards(page).nth(30).getByRole('link').click();
    await expect(heading(page)).toHaveText('Movie 31 [en] (2020)');
    await page.goBack();

    await expect(heading(page)).toHaveText('Explore');
    await expect(cards(page).nth(30)).toContainText('Movie 31 [en] (2020)');
    await expect(cards(page).nth(30)).toBeInViewport();
    await expect(
      filters.getByRole('checkbox', { name: 'Comedy' }),
    ).toBeChecked();
    expect(firstPages()).toBe(asked);
  });

  test('finds the tv shows of a decade, up to an age rating, in a language', async ({
    page,
    tmdb,
  }) => {
    await openPage(page, 'settings');
    await chooseCountry(page, 'Brazil');
    await openPage(page, 'discover');

    await page.getByRole('radio', { name: 'TV shows' }).check();
    const filters = page.getByRole('complementary', { name: 'Filters' });
    await filters.getByRole('button', { name: '2000s' }).click();
    await filters.getByRole('radio', { name: /^14:/ }).check();
    await filters
      .getByRole('combobox', { name: 'Original language' })
      .fill('Kor');
    await page.getByRole('option', { name: 'Korean' }).click();

    await expect(cards(page).first()).toContainText('Show 1 [en] (2008)');
    await expect
      .poll(() => tmdb.lastDiscovery())
      .toMatchObject({
        path: '/3/discover/tv',
        'first_air_date.gte': '2000-01-01',
        'first_air_date.lte': '2009-12-31',
        certification_country: 'BR',
        // by name: "up to" would take the titles not rated too
        certification: 'L|10|12|14',
        with_original_language: 'ko',
      });
    await expect(page).toHaveURL(
      /#\/discover\?type=tv&from=2000&to=2009&original=ko&age=14$/,
    );
  });

  test('names in the language a genre of tv shows TMDB has only in English', async ({
    page,
  }) => {
    await openPage(page, 'discover');
    await chooseLanguage(page, 'Português (Brasil)');
    await page.getByRole('radio', { name: 'Séries' }).check();

    const filters = page.getByRole('complementary', { name: 'Filtros' });
    await expect(
      filters.getByRole('checkbox', { name: 'Ação e aventura' }),
    ).toBeVisible();
  });

  test('keeps the services of the user, to show only what is on them', async ({
    page,
    tmdb,
  }) => {
    await openPage(page, 'settings');
    await chooseCountry(page, 'Brazil');
    await openPage(page, 'discover');

    const filters = page.getByRole('complementary', { name: 'Filters' });
    await filters.getByRole('button', { name: 'Choose my services' }).click();
    await filters.getByRole('checkbox', { name: 'Netflix' }).check();
    await filters.getByRole('checkbox', { name: 'Amazon Prime Video' }).check();
    await filters.getByRole('button', { name: 'Done' }).click();

    await expect(page).toHaveURL(/#\/discover\?mine=1$/);
    await expect
      .poll(() => tmdb.lastDiscovery())
      .toMatchObject({ watch_region: 'BR', with_watch_providers: '8|119' });

    // kept for the next time, with the switch off until it is wanted
    await openPage(page, 'home');
    await openPage(page, 'discover');
    const only = filters.getByRole('switch', {
      name: 'Only what is on my services',
    });
    await expect(only).not.toBeChecked();
    await expect(
      filters.getByRole('list', { name: 'Your services' }),
    ).toHaveText(/Netflix\s*Amazon Prime Video/);
    await only.check();
    await expect
      .poll(() => tmdb.lastDiscovery())
      .toMatchObject({ with_watch_providers: '8|119' });
  });

  test('says when no title has the filters, and clears them', async ({
    page,
  }) => {
    await openPage(page, 'discover');
    const filters = page.getByRole('complementary', { name: 'Filters' });

    await filters.getByRole('checkbox', { name: 'Documentary' }).check();

    await expect(page).toHaveURL(
      new RegExp(`#/discover\\?genres=${GENRE_WITHOUT_TITLES}$`),
    );
    await expect(page.getByText('No titles with these filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear the filters' }).click();

    await expect(cards(page)).toHaveCount(20);
    await expect(page).toHaveURL(/#\/discover$/);
  });
});
