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

    const rating = page.getByLabel('Your rating');
    await rating.selectOption({ label: '7.5' });

    await expect.poll(() => tmdb.ratings()).toEqual({ 'movie:1': 7.5 });

    await openPage(page, 'rated');

    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Your rating: 7.5');

    await cards(page).first().getByRole('link').click();
    await expect(rating).toHaveValue('7.5');
    await rating.selectOption({ label: 'Not rated' });

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
