import type { Page } from '@playwright/test';
import { ACCOUNT_OBJECT_ID } from './support/fake-tmdb';
import {
  cards,
  chooseLanguage,
  expect,
  heading,
  openPage,
  test,
} from './support/fixtures';
import { signIn } from './support/login';

/** A row of the home page, by its title. */
const list = (page: Page, title: string) =>
  page.getByRole('region', { name: title, exact: true });

// The app opens on the home page, which shows the lists at once.
test.describe('home page', () => {
  test('shows what is trending and popular, without a search', async ({
    page,
    tmdb,
  }) => {
    const trending = list(page, 'Trending this week');

    await expect(trending.getByRole('article')).toHaveCount(3);
    await expect(trending.getByRole('link')).toHaveText([
      'Movie 1 [en]',
      'Show 1 [en]',
      'Movie 2 [en]',
    ]);
    // people are trending too, at TMDB, but they have no page here
    await expect(page.getByText('A Trending Person')).toHaveCount(0);
    await expect(list(page, 'Popular movies').getByRole('article')).toHaveCount(
      3,
    );
    await expect(list(page, 'Popular TV shows')).toContainText('Show 11 [en]');
    expect(
      tmdb.lists().map(({ path, language }) => `${path} ${language}`),
    ).toEqual(
      expect.arrayContaining([
        '/3/movie/popular en',
        '/3/trending/all/week en',
        '/3/tv/popular en',
      ]),
    );
    // the rows further down wait until they come near
    expect(tmdb.discoveries()).toHaveLength(0);

    const comedies = list(page, 'Popular movies: Comedy');
    await comedies.scrollIntoViewIfNeeded();
    await expect(comedies.getByRole('article').first()).toContainText(
      'Movie 1 [en]',
    );
    // with the rows around it, now near too
    expect(tmdb.discoveries()).toContainEqual(
      expect.objectContaining({ path: '/3/discover/movie', with_genres: '35' }),
    );
    // in the theaters of the country of the settings, once there
    const theaters = list(page, 'Now playing in theaters');
    await theaters.scrollIntoViewIfNeeded();
    await expect(theaters).toContainText('Movie 21 [en]');
  });

  test('scrolls the rows sideways without the bar of the system, which has the colors of the app', async ({
    page,
  }) => {
    const row = list(page, 'Trending this week').getByRole('list').first();
    const html = page.locator('html');

    await expect(row).toHaveCSS('overflow-x', 'auto');
    await expect(row).toHaveCSS('scrollbar-width', 'none');
    await expect(html).toHaveCSS('color-scheme', 'light');
    await expect(html).toHaveCSS(
      'scrollbar-color',
      'rgb(203, 213, 225) rgba(0, 0, 0, 0)',
    );
  });

  test('shows what TMDB recommends to whoever signed in, without what is in their watchlist', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    // on the TMDB website, before signing in here
    tmdb.addToList('watchlist', 'movie:32');

    await expect(list(page, 'Trending this week')).toBeVisible();
    await expect(list(page, 'For you')).toHaveCount(0);

    await openPage(page, 'account');
    await signIn(running, tmdb);
    await openPage(page, 'home');

    const forYou = list(page, 'For you');
    await expect(forYou).toContainText('Recommended by TMDB for your account');
    // a movie and a tv show in turn
    await expect(forYou.getByRole('link')).toHaveText([
      'Movie 31 [en]',
      'Show 31 [en]',
      'Movie 33 [en]',
      'Show 32 [en]',
      'Show 33 [en]',
    ]);
    expect(
      tmdb.requests
        .filter(({ path }) => path.endsWith('/recommendations'))
        .map(({ path, credential, language }) => [path, credential, language]),
    ).toEqual(
      expect.arrayContaining([
        [
          `/4/account/${ACCOUNT_OBJECT_ID}/movie/recommendations`,
          'account',
          'en',
        ],
        [`/4/account/${ACCOUNT_OBJECT_ID}/tv/recommendations`, 'account', 'en'],
      ]),
    );
  });

  test('opens the page of a title, and comes back to the lists', async ({
    page,
    tmdb,
  }) => {
    await list(page, 'Trending this week')
      .getByRole('link', { name: 'Show 1 [en]' })
      .click();

    await expect(page).toHaveURL(/#\/tv\/9001$/);
    await expect(heading(page)).toHaveText('Show 1 [en] (2008)');
    const asked = tmdb.lists().length;

    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page).toHaveURL(/#\/home$/);
    await expect(
      list(page, 'Trending this week').getByRole('article'),
    ).toHaveCount(3);
    // the rows were kept, not asked for again
    expect(tmdb.lists()).toHaveLength(asked);
  });

  test('follows the language chosen in the menu', async ({ page, tmdb }) => {
    await expect(list(page, 'Trending this week')).toContainText(
      'Movie 1 [en]',
    );

    await chooseLanguage(page, 'Português (Brasil)');

    await expect(list(page, 'Em alta na semana')).toContainText(
      'Movie 1 [pt-BR]',
    );
    expect(tmdb.lists().at(-1)?.language).toBe('pt-BR');
  });

  test('shows the movies or the tv shows alone, trending of that type too', async ({
    page,
    tmdb,
  }) => {
    await page.getByRole('radio', { name: 'TV shows' }).check();

    await expect(page).toHaveURL(/#\/home\?type=tv$/);
    await expect(list(page, 'Trending this week').getByRole('link')).toHaveText(
      ['Show 1 [en]', 'Show 2 [en]', 'Show 3 [en]', 'Show 4 [en]'],
    );
    await expect(list(page, 'Popular movies')).toHaveCount(0);
    expect(tmdb.lists().map(({ path }) => path)).toContain(
      '/3/trending/tv/week',
    );
  });

  test('takes a row made in Explore, and changes the rows', async ({
    page,
    tmdb,
  }) => {
    await openPage(page, 'discover');
    await page
      .getByRole('complementary', { name: 'Filters' })
      .getByRole('checkbox', { name: 'Action' })
      .check();
    await expect(page).toHaveURL(/genres=28$/);
    await page.getByRole('button', { name: 'On the home page' }).click();
    await expect(
      page.getByRole('button', { name: 'On the home page' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await openPage(page, 'home');

    // at the top, where it shows at once
    const action = list(page, 'Popular movies: Action');
    await expect(
      page.locator('main section, section').first(),
    ).toHaveAccessibleName('Popular movies: Action');
    await expect(action.getByRole('article')).toHaveCount(20);
    await expect
      .poll(() => tmdb.lastDiscovery())
      .toMatchObject({ path: '/3/discover/movie', with_genres: '28' });

    // all of it in Explore
    await action
      .getByRole('link', { name: 'See all: Popular movies: Action' })
      .click();
    await expect(page).toHaveURL(/#\/discover\?genres=28$/);
    await expect(cards(page)).toHaveCount(20);

    await openPage(page, 'home');
    await page.getByRole('button', { name: 'Customize the home page' }).click();
    await page
      .getByRole('button', { name: 'Move down: Popular movies: Action' })
      .click();
    await page
      .getByRole('button', { name: 'Remove: Trending this week' })
      .click();
    await expect(
      page.getByRole('region', { name: /Notifications/ }),
    ).toContainText('Trending this week left the home page.');
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(list(page, 'Trending this week')).toHaveCount(0);
    await expect(
      page.locator('main section, section').first(),
    ).toHaveAccessibleName('Popular movies: Action');

    // kept for the next time
    await page.reload();
    await expect(list(page, 'Popular movies: Action')).toBeVisible();
    await expect(list(page, 'Trending this week')).toHaveCount(0);
  });
});
