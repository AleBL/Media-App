import { ACCOUNT } from '../support/fake-tmdb';
import { cards, heading, openPage, searchBox } from '../support/fixtures';
import { expect, test } from './fixtures';

// The lists of the account on the web version: the site changes them at
// TMDB with the session in its cookie (api/account.ts), which the page
// never sees.
test.describe('watchlist and favorites on the web version', () => {
  test('keeps a title in the watchlist, through the site', async ({
    page,
    site,
    tmdb,
    received,
  }) => {
    await page.goto(site.url);
    await openPage(page, 'account');
    await page.getByRole('button', { name: 'Sign in with TMDB' }).click();
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();

    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await cards(page).first().getByRole('link').click();
    await expect(heading(page)).toHaveText('Movie 1 [en] (2020)');

    const myList = page.getByRole('button', { name: 'My list', exact: true });
    await expect(myList).toHaveAttribute('aria-pressed', 'false');
    await myList.click();

    await expect(myList).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => tmdb.listed('watchlist')).toEqual(['movie:1']);

    await openPage(page, 'watchlist');

    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Movie 1 [en] (2020)');

    // The session stayed with the site.
    const seen = await page.evaluate(() =>
      JSON.stringify([
        { ...localStorage },
        document.cookie,
        document.documentElement.outerHTML,
      ]),
    );

    for (const session of tmdb.sessions()) {
      expect(seen).not.toContain(session);

      for (const [address, body] of received) {
        expect(body.includes(session), address).toBe(false);
      }
    }

    // Besides the sign in, which goes to the TMDB website, the browser only
    // talked to the site.
    for (const address of received.keys()) {
      expect(
        address.startsWith(site.url) || address.startsWith(tmdb.approvalUrl),
        address,
      ).toBe(true);
    }
  });

  test('the cards change the lists, through the site', async ({
    page,
    site,
    tmdb,
  }) => {
    tmdb.addToList('watchlist', 'movie:1');
    await page.goto(site.url);
    await openPage(page, 'account');
    await page.getByRole('button', { name: 'Sign in with TMDB' }).click();
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();

    await openPage(page, 'search');
    await searchBox(page).fill('matrix');

    const myList = page.getByRole('button', { name: 'My list: Movie 1 [en]' });
    await expect(myList).toHaveAttribute('aria-pressed', 'true');

    await myList.click();

    await expect(myList).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => tmdb.listed('watchlist')).toEqual([]);
  });

  test('the pages of the lists ask to sign in first', async ({
    page,
    site,
  }) => {
    await page.goto(`${site.url}#/favorites`);

    await expect(page).toHaveURL(/#\/account\?next=/);
    await expect(
      page.getByRole('button', { name: 'Sign in with TMDB' }),
    ).toBeVisible();
  });
});
