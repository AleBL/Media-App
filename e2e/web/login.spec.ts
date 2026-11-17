import type { Page } from '@playwright/test';
import { ACCOUNT, APP_TOKEN } from '../support/fake-tmdb';
import { openPage } from '../support/fixtures';
import { accountLink as accountItem } from '../support/login';
import { expect, test } from './fixtures';

const SESSION_COOKIE = 'media-app-session';

const accountLink = (page: Page) => page.locator(accountItem);
const signInButton = (page: Page) =>
  page.getByRole('button', { name: 'Sign in with TMDB' });

// The browser really leaves the app here. Where the site would send it to
// the TMDB website, it goes to the page of the stand-in that answers by
// itself what `tmdb.website.answer` says (approving, unless a test changes
// it) and sends the browser back like TMDB does.
async function signIn(page: Page, siteUrl: string) {
  await page.goto(siteUrl);
  await openPage(page, 'account');
  await signInButton(page).click();
}

const sessionCookie = async (page: Page) =>
  (await page.context().cookies()).find(({ name }) => name === SESSION_COOKIE);

// Signing in on the web version: the site keeps the session, in a cookie
// that the page cannot read (the files in /api/auth on Vercel).
test.describe('signing in on the web version', () => {
  test('goes to the TMDB website and comes back signed in', async ({
    page,
    site,
    tmdb,
  }) => {
    await signIn(page, site.url);

    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();
    await expect(page).toHaveURL(`${site.url}#/account`);
    await expect(accountLink(page)).toContainText(ACCOUNT.name);
    // a v4 request token, which keeps the way back to the site
    expect(tmdb.website.visits).toEqual([
      {
        requestToken: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/),
        redirectTo: `${site.url}api/auth/callback`,
      },
    ]);
    expect(tmdb.accessTokens()).toHaveLength(1);
    expect(tmdb.sessions()).toHaveLength(1);
  });

  test('stays signed in when the page is loaded again', async ({
    page,
    site,
    tmdb,
  }) => {
    await signIn(page, site.url);
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();

    await page.goto(site.url);

    await expect(accountLink(page)).toContainText(ACCOUNT.name);
    expect(tmdb.sessions()).toHaveLength(1);
  });

  test('the session never reaches the page', async ({
    page,
    site,
    tmdb,
    received,
  }) => {
    await signIn(page, site.url);
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();

    const [session] = tmdb.sessions();
    const [accessToken] = tmdb.accessTokens();
    const cookie = await sessionCookie(page);
    const access = (await page.context().cookies()).find(
      ({ name }) => name === 'media-app-access',
    );

    // The browser holds them for the site, out of reach of scripts.
    expect(cookie?.value).toBe(session);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    expect(cookie?.expires).toBeGreaterThan(Date.now() / 1000 + 179 * 86400);
    expect(access?.value).toBe(accessToken);
    expect(access?.httpOnly).toBe(true);

    const seen = await page.evaluate(() =>
      JSON.stringify([
        { ...localStorage },
        { ...sessionStorage },
        document.cookie,
        document.documentElement.outerHTML,
      ]),
    );

    expect(seen).not.toContain(session);
    expect(seen).not.toContain(accessToken);
    expect(received.size).toBeGreaterThan(3);

    for (const [address, body] of received) {
      expect(address.includes(session), address).toBe(false);
      expect(body.includes(session), address).toBe(false);
      expect(address.includes(accessToken), address).toBe(false);
      expect(body.includes(accessToken), address).toBe(false);
      expect(body.includes(APP_TOKEN), address).toBe(false);
    }
  });

  test('says once that the access was refused, and lets the user try again', async ({
    page,
    site,
    tmdb,
  }) => {
    tmdb.website.answer = 'deny';
    await signIn(page, site.url);

    await expect(page.getByRole('alert')).toContainText(
      'The access was not approved on the TMDB website.',
    );
    await expect(accountLink(page)).toContainText('Sign in');
    expect(tmdb.sessions()).toHaveLength(0);
    expect(await sessionCookie(page)).toBeUndefined();

    await page.reload();

    await expect(signInButton(page)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    tmdb.website.answer = 'approve';
    await signInButton(page).click();

    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();
    expect(tmdb.website.visits).toHaveLength(2);
  });

  test('signs out, in the browser and at TMDB', async ({
    page,
    site,
    tmdb,
  }) => {
    await signIn(page, site.url);
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(signInButton(page)).toBeVisible();
    await expect(accountLink(page)).toContainText('Sign in');
    expect(tmdb.sessions()).toHaveLength(0);
    expect(tmdb.accessTokens()).toHaveLength(0);
    expect(await page.context().cookies()).toEqual([]);

    await page.reload();

    await expect(signInButton(page)).toBeVisible();
  });

  test('signs out when the session was ended on the TMDB website', async ({
    page,
    site,
    tmdb,
  }) => {
    await signIn(page, site.url);
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();

    tmdb.endSessions();
    await page.reload();

    await expect(signInButton(page)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await sessionCookie(page)).toBeUndefined();
  });

  test('only the app itself signs anyone out', async ({ page, site, tmdb }) => {
    await signIn(page, site.url);
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();

    // What a form on another site would send, if the browser let the
    // cookie go with it.
    const forged = await page.request.post(`${site.url}api/auth/logout`, {
      headers: { Origin: 'https://evil.test' },
    });
    // A link or an image on another site can only make a GET.
    const linked = await page.request.get(`${site.url}api/auth/logout`);

    expect(forged.status()).toBe(403);
    expect(linked.status()).toBe(405);
    expect(tmdb.sessions()).toHaveLength(1);

    await page.reload();

    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();
  });

  test('a way back that no login is waiting for changes nothing', async ({
    page,
    site,
    tmdb,
  }) => {
    await page.goto(
      `${site.url}api/auth/callback?request_token=${'f'.repeat(40)}&approved=true`,
    );

    await expect(page).toHaveURL(`${site.url}#/account`);
    await expect(signInButton(page)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(
      tmdb.requests.filter(({ path }) => /\/auth(entication)?\//.test(path)),
    ).toHaveLength(0);
    expect(await page.context().cookies()).toHaveLength(0);
  });
});
