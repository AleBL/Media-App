import type { Page } from '@playwright/test';
import {
  cards,
  expect,
  heading,
  openPage,
  searchBox,
  test,
} from './support/fixtures';
import { accountLink, comeBack, signIn, startLogin } from './support/login';

const SIGN_IN_TO_SAVE = 'Sign in to keep this title in your list or favorites';

/** Opens the page of the first movie that a search finds. */
async function openMovie(page: Page) {
  await openPage(page, 'search');
  await searchBox(page).fill('matrix');
  await cards(page).first().getByRole('link').click();
  await expect(heading(page)).toHaveText('Movie 1 [en] (2020)');
}

const toggle = (page: Page, name: 'My list' | 'Favorite') =>
  page.getByRole('button', { name, exact: true });

// The watchlist and the favorites are lists of the TMDB account: they need
// someone signed in, and live at TMDB.
test.describe('watchlist and favorites', () => {
  test('the page of a title asks to sign in, and comes back after it', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    await openMovie(page);

    await page.getByRole('link', { name: SIGN_IN_TO_SAVE }).click();
    await expect(page).toHaveURL(/#\/account\?next=/);

    const { requestToken, redirectTo } = await startLogin(running);
    tmdb.approve(requestToken);
    await comeBack(redirectTo, requestToken);

    await expect(page).toHaveURL(/#\/movie\/1$/);
    await expect(toggle(page, 'My list')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('keeps titles in the lists, and shows them in pages of their own', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    await openPage(page, 'account');
    await signIn(running, tmdb);
    await openMovie(page);

    await toggle(page, 'My list').click();
    await toggle(page, 'Favorite').click();

    await expect(toggle(page, 'My list')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(toggle(page, 'Favorite')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect.poll(() => tmdb.listed('watchlist')).toEqual(['movie:1']);
    await expect.poll(() => tmdb.listed('favorite')).toEqual(['movie:1']);

    await openPage(page, 'watchlist');

    await expect(heading(page)).toHaveText('My list');
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Movie 1 [en] (2020)');

    await page.getByRole('radio', { name: 'TV shows' }).check();

    await expect(page.getByText('Nothing here yet.')).toBeVisible();

    // Out of the favorites, from the page of the title.
    await openPage(page, 'favorites');
    await cards(page).first().getByRole('link').click();
    await toggle(page, 'Favorite').click();
    await expect.poll(() => tmdb.listed('favorite')).toEqual([]);

    await page.getByRole('button', { name: 'Back' }).click();

    await expect(heading(page)).toHaveText('Favorites');
    await expect(page.getByText('No favorites here yet.')).toBeVisible();
  });

  test('a session ended on the TMDB website signs the user out at the next change', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    await openPage(page, 'account');
    await signIn(running, tmdb);
    await openMovie(page);
    await expect(toggle(page, 'My list')).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    tmdb.endSessions();
    await toggle(page, 'My list').click();

    await expect(page.locator(accountLink)).toHaveText('Sign in');
    await expect(
      page.getByRole('link', { name: SIGN_IN_TO_SAVE }),
    ).toBeVisible();
    expect(tmdb.listed('watchlist')).toEqual([]);
  });
});
