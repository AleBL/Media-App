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

/** Opens the page of the first movie that a search finds. */
async function openMovie(page: Page) {
  await openPage(page, 'search');
  await searchBox(page).fill('matrix');
  await cards(page).first().getByRole('link').click();
  await expect(heading(page)).toHaveText('Movie 1 [en] (2020)');
}

const rating = (page: Page) => page.getByLabel('Your rating');

// Ratings belong to the TMDB account, like the watchlist: they need someone
// signed in, and live at TMDB.
test.describe('ratings', () => {
  test('rates a title on its page, and lists it among the rated titles', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    await openPage(page, 'account');
    await signIn(running, tmdb);
    await openMovie(page);

    await expect(rating(page)).toBeEnabled();
    await expect(rating(page).locator('option:checked')).toHaveText(
      'Not rated',
    );

    await rating(page).selectOption({ label: '8.5' });

    await expect.poll(() => tmdb.ratings()).toEqual({ 'movie:1': 8.5 });

    await openPage(page, 'rated');

    await expect(heading(page)).toHaveText('Rated');
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Your rating: 8.5');

    // Taken away, from the page of the title.
    await cards(page).first().getByRole('link').click();
    await expect(rating(page)).toHaveValue('8.5');
    await rating(page).selectOption({ label: 'Not rated' });
    await expect.poll(() => tmdb.ratings()).toEqual({});

    await page.getByRole('button', { name: 'Back' }).click();

    await expect(heading(page)).toHaveText('Rated');
    await expect(page.getByText('Nothing rated yet.')).toBeVisible();
  });

  test('shows a rating given on the TMDB website, and the watchlist it changes', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    // On the TMDB website, before signing in here.
    tmdb.rateOnWebsite('movie:1', 4);
    tmdb.addToList('watchlist', 'movie:1');
    await openPage(page, 'account');
    await signIn(running, tmdb);
    await openMovie(page);

    const myList = page.getByRole('button', { name: 'My list', exact: true });
    await expect(rating(page)).toHaveValue('4');
    await expect(myList).toHaveAttribute('aria-pressed', 'true');

    // TMDB takes a title it rates out of the watchlist, by default.
    await rating(page).selectOption({ label: '6.0' });

    await expect(myList).toHaveAttribute('aria-pressed', 'false');
    expect(tmdb.ratings()).toEqual({ 'movie:1': 6 });
    expect(tmdb.listed('watchlist')).toEqual([]);
  });
});
