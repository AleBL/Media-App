import { ACCOUNT } from '../support/fake-tmdb';
import { cards, heading, openPage, searchBox } from '../support/fixtures';
import { expect, test } from './fixtures';

// The ratings on the web version: the site changes them at TMDB with the
// session in its cookie (api/account.ts), which the page never sees.
test.describe('ratings on the web version', () => {
  test('rates a title and takes the rating away, through the site', async ({
    page,
    site,
    tmdb,
  }) => {
    await page.goto(site.url);
    await openPage(page, 'account');
    await page.getByRole('button', { name: 'Sign in with TMDB' }).click();
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();

    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await cards(page).first().getByRole('link').click();
    await expect(heading(page)).toHaveText('Movie 1 [en] (2020)');

    const rating = page.getByRole('radiogroup', { name: 'Your rating' });
    // The half of a star, which holds its radio button out of sight.
    await rating
      .locator('label')
      .filter({ has: page.getByText('7.5', { exact: true }) })
      .click();

    await expect.poll(() => tmdb.ratings()).toEqual({ 'movie:1': 7.5 });

    await openPage(page, 'rated');

    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Your rating: 7.5');

    await cards(page).first().getByRole('link').click();
    await expect(rating.locator('input:checked')).toHaveValue('7.5');
    await page.getByRole('button', { name: 'Remove the rating' }).click();

    await expect.poll(() => tmdb.ratings()).toEqual({});
  });

  test('the page of the rated titles asks to sign in first', async ({
    page,
    site,
  }) => {
    await page.goto(`${site.url}#/rated`);

    await expect(page).toHaveURL(/#\/account\?next=/);
  });
});
