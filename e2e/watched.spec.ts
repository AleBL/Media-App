import type { Page } from '@playwright/test';
import {
  cards,
  expect,
  heading,
  openPage,
  searchBox,
  test,
} from './support/fixtures';
import { signIn } from './support/login';

/** The day of the user, as the app writes it: YYYY-MM-DD. */
const today = () => new Date().toLocaleDateString('sv-SE');

/** Opens the page of the movie that a search finds at `index`. */
async function openMovie(page: Page, index = 0) {
  await openPage(page, 'search');
  await searchBox(page).fill('matrix');
  await cards(page).nth(index).getByRole('link').click();
  await expect(heading(page)).toHaveText(`Movie ${index + 1} [en] (2020)`);
}

const watchedButton = (page: Page) =>
  page.getByRole('button', { name: 'Watched', exact: true });

// TMDB has no "watched": the app keeps it in a private list of the account
// (v4), which it makes the first time a title is marked.
test.describe('watched titles', () => {
  test('marks a title watched, in a private list of the account, and lists it with the day', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    await openPage(page, 'account');
    await signIn(running, tmdb);
    await openMovie(page);

    await expect(watchedButton(page)).toHaveAttribute('aria-pressed', 'false');
    // nothing marked yet: no list made for nothing
    expect(tmdb.userLists()).toEqual([]);

    await watchedButton(page).click();

    await expect(watchedButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => tmdb.watched()).toEqual({ 'movie:1': today() });
    // made private only after the title went in, so a moment later
    await expect
      .poll(() => tmdb.userLists())
      .toEqual([
        { name: 'Watched', public: false, sortBy: 'original_order.desc' },
      ]);

    await openPage(page, 'watched');

    await expect(heading(page)).toHaveText('Watched');
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Movie 1 [en] (2020)');
    await expect(cards(page).first()).toContainText('Watched on');

    // Taken back, from the page of the title.
    await cards(page).first().getByRole('link').click();
    await watchedButton(page).click();
    await expect.poll(() => tmdb.watched()).toEqual({});

    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page.getByText('Nothing watched yet.')).toBeVisible();
  });

  test('makes the list again, at the first click, when it was deleted on the TMDB website', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    await openPage(page, 'account');
    await signIn(running, tmdb);
    await openMovie(page);
    await watchedButton(page).click();
    await expect.poll(() => tmdb.watched()).toEqual({ 'movie:1': today() });

    // which TMDB goes on listing for a while
    tmdb.deleteUserLists({ stillListed: true });
    await page.reload();
    await expect(watchedButton(page)).toHaveAttribute('aria-pressed', 'false');
    await watchedButton(page).click();

    await expect.poll(() => tmdb.watched()).toEqual({ 'movie:1': today() });
    await expect(watchedButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect
      .poll(() => tmdb.userLists())
      .toEqual([
        { name: 'Watched', public: false, sortBy: 'original_order.desc' },
      ]);
  });
});
