import { ACCOUNT } from '../support/fake-tmdb';
import { cards, heading, openPage, searchBox } from '../support/fixtures';
import { expect, test } from './fixtures';

// The watched titles on the web version: the site keeps the list with the
// access token of the user, in a cookie the page never sees.
test.describe('watched titles on the web version', () => {
  test('marks a title watched through the site, and lists it', async ({
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

    const watched = page.getByRole('button', { name: 'Watched', exact: true });
    await expect(watched).toHaveAttribute('aria-pressed', 'false');
    await watched.click();

    await expect(watched).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() => Object.keys(tmdb.watched() ?? {}))
      .toEqual(['movie:1']);

    await openPage(page, 'watched');

    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Watched on');

    // The access token of the user stayed with the site.
    const [accessToken] = tmdb.accessTokens();
    const seen = await page.evaluate(() =>
      JSON.stringify([document.cookie, document.documentElement.outerHTML]),
    );

    expect(seen).not.toContain(accessToken);
    for (const [address, body] of received) {
      expect(body.includes(accessToken), address).toBe(false);
    }
  });

  test('the page of the watched titles asks to sign in first', async ({
    page,
    site,
  }) => {
    await page.goto(`${site.url}#/watched`);

    await expect(page).toHaveURL(/#\/account\?next=/);
  });
});
