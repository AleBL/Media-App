import { MISSING_MOVIE, TRAILER_KEY } from './support/fake-tmdb';
import {
  cards,
  expect,
  heading,
  openPage,
  searchBox,
  test,
} from './support/fixtures';

test.describe('page of a title', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await expect(cards(page)).toHaveCount(20);
  });

  test('opens from a search result, with what TMDB says about it', async ({
    page,
    tmdb,
  }) => {
    await cards(page).nth(1).getByRole('link').click();

    await expect(page).toHaveURL(/#\/movie\/2$/);
    await expect(heading(page)).toHaveText('Movie 2 [en] (2020)');
    await expect(
      page.getByText('The story of title 2, told in en.'),
    ).toBeVisible();
    await expect(page.getByText('Ada Actor')).toBeVisible();
    await expect(page.getByText('Villain')).toBeVisible();
    expect(tmdb.pages()).toEqual([
      {
        path: '/3/movie/2',
        credential: 'app',
        language: 'en',
        append_to_response: 'credits,videos,watch/providers,external_ids',
        include_video_language: 'en,en-US,null',
      },
    ]);
  });

  test('shows where to watch in the region of the system, from JustWatch', async ({
    page,
  }) => {
    await cards(page).first().getByRole('link').click();

    await expect(
      page.getByRole('heading', { name: 'Where to watch in United States' }),
    ).toBeVisible();
    await expect(page.getByText('Stream US')).toBeVisible();
    await expect(page.getByText('Stream BR')).toHaveCount(0);
    await expect(
      page.getByText('Where to watch: data from JustWatch.'),
    ).toBeVisible();
  });

  test('opens the trailer and IMDb in the browser of the system', async ({
    page,
    running,
  }) => {
    await cards(page).first().getByRole('link').click();
    await expect(heading(page)).toBeVisible();

    await page.getByRole('link', { name: 'Watch the trailer' }).click();
    await page.getByRole('link', { name: 'See on IMDb' }).click();

    await expect
      .poll(running.openedInBrowser)
      .toEqual([
        `https://www.youtube.com/watch?v=${TRAILER_KEY}`,
        'https://www.imdb.com/title/tt0133093/',
      ]);
    // The window still shows the app.
    await expect(page).toHaveURL(/#\/movie\/1$/);
  });

  test('goes back to the results it came from', async ({ page, tmdb }) => {
    await page.locator('.paginator-pages button').nth(1).click();
    await expect(cards(page).first()).toContainText('Movie 21');

    await cards(page).first().getByRole('link').click();
    await expect(heading(page)).toHaveText('Movie 21 [en] (2020)');
    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page).toHaveURL(/#\/search$/);
    await expect(cards(page).first()).toContainText('Movie 21');
    // the results were kept, not asked for again
    expect(tmdb.searches()).toHaveLength(2);
  });

  test('opens a tv show', async ({ page }) => {
    await page.getByText('TV Show', { exact: true }).click();
    await expect(cards(page).first()).toContainText('Show 1');

    await cards(page).first().getByRole('link').click();

    await expect(page).toHaveURL(/#\/tv\/9001$/);
    await expect(heading(page)).toHaveText('Show 1 [en] (2008)');
    await expect(page.getByText('5 seasons')).toBeVisible();
    await expect(page.getByText('47 min per episode')).toBeVisible();
  });

  test('follows the language chosen in the menu', async ({ page, tmdb }) => {
    await cards(page).first().getByRole('link').click();
    await expect(heading(page)).toHaveText('Movie 1 [en] (2020)');

    await page.locator('header button:has(.pi-language)').click();
    await page.getByText('pt-BR', { exact: true }).click();

    await expect(heading(page)).toHaveText('Movie 1 [pt-BR] (2020)');
    await expect(page.getByText('Onde assistir: Estados Unidos')).toBeVisible();
    expect(tmdb.pages().at(-1)?.language).toBe('pt-BR');
  });

  test('says so when TMDB does not have the title', async ({ page }) => {
    await page.evaluate((id) => {
      window.location.hash = `#/movie/${id}`;
    }, MISSING_MOVIE);

    await expect(page.getByRole('alert')).toContainText(
      'This title was not found on TMDB.',
    );
  });
});
