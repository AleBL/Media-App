import { ACCOUNT, VALID_KEY } from './support/fake-tmdb';
import { cards, expect, openPage, saveKey, test } from './support/fixtures';
import { accountLink, comeBack, startLogin } from './support/login';

test.describe('signing in with TMDB', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, 'account');
  });

  test('approving in the browser signs the user in', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    await expect(page.locator(accountLink)).toHaveText('Sign in');

    const { url, requestToken, redirectTo } = await startLogin(running);

    // The real TMDB website (v4), with a way back that only this computer
    // reaches, at an address made up for this login.
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.themoviedb.org/auth/access',
    );
    expect(redirectTo).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/callback\/[0-9a-f]{32}$/,
    );
    await expect(page.getByRole('status')).toContainText(
      'Approve the access on the TMDB page',
    );
    await expect(page.locator('#authorize-url')).toHaveValue(url.toString());

    tmdb.approve(requestToken);
    const answer = await comeBack(redirectTo);

    expect(answer.status).toBe(200);
    expect(await answer.text()).toContain('You are signed in');
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();
    await expect(page.locator(accountLink)).toHaveText(ACCOUNT.name);
    // the access of the user, and the session made from it
    expect(tmdb.accessTokens()).toHaveLength(1);
    expect(tmdb.sessions()).toHaveLength(1);
  });

  test('with a key of the user, signs in through TMDB v3', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    // v4 takes no key: the login goes the way it went before v4.
    await saveKey(page, VALID_KEY);
    await openPage(page, 'account');

    const { url, requestToken, redirectTo } = await startLogin(running);

    expect(`${url.origin}${url.pathname}`).toBe(
      `https://www.themoviedb.org/authenticate/${requestToken}`,
    );
    expect(redirectTo).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/callback\/[0-9a-f]{32}$/,
    );

    tmdb.approve(requestToken);
    await comeBack(`${redirectTo}?request_token=${requestToken}&approved=true`);

    await expect(page.locator(accountLink)).toHaveText(ACCOUNT.name);
    expect(tmdb.sessions()).toHaveLength(1);
    expect(tmdb.accessTokens()).toHaveLength(0);
  });

  test('confirming by hand works when the browser does not come back', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    const { requestToken } = await startLogin(running);
    const confirm = page.getByRole('button', {
      name: 'I already approved in the browser',
    });

    // Too early: nobody approved anything yet.
    await confirm.click();
    await expect(page.getByRole('alert')).toContainText(
      'TMDB has not confirmed the approval yet',
    );
    expect(tmdb.sessions()).toHaveLength(0);

    tmdb.approve(requestToken);
    await confirm.click();

    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('a refusal on the TMDB website is told, and the user can try again', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    const refused = await startLogin(running);

    // The browser comes back, but the request token was never approved.
    const answer = await comeBack(refused.redirectTo);

    expect(await answer.text()).toContain('The sign-in was not completed');
    await expect(page.getByRole('alert')).toContainText(
      'The access was not approved on the TMDB website',
    );

    const again = await startLogin(running, 'Try again');

    expect(again.requestToken).not.toBe(refused.requestToken);
    tmdb.approve(again.requestToken);
    await comeBack(again.redirectTo);

    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();
  });

  test('cancelling stops listening for the browser', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    const { requestToken, redirectTo } = await startLogin(running);

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(
      page.getByRole('button', { name: 'Sign in with TMDB' }),
    ).toBeVisible();

    // An approval that arrives now finds nobody at the door.
    tmdb.approve(requestToken);
    await expect(comeBack(redirectTo)).rejects.toThrow();
    expect(tmdb.sessions()).toHaveLength(0);
    await expect(page.locator(accountLink)).toHaveText('Sign in');
  });

  test('only the callback of this login counts', async ({ running, tmdb }) => {
    const { page } = running;
    const { requestToken, redirectTo } = await startLogin(running);
    const { origin } = new URL(redirectTo);

    const strangers = await Promise.all([
      fetch(`${origin}/favicon.ico`),
      fetch(`${origin}/`),
      // the way back without the part made up for this login
      fetch(`${origin}/callback`),
      fetch(`${origin}/callback?request_token=${requestToken}&approved=true`),
      fetch(`${origin}/callback/${'0'.repeat(32)}`),
      fetch(redirectTo, { method: 'POST' }),
    ]);

    expect(strangers.map((answer) => answer.status)).toEqual([
      404, 404, 404, 404, 404, 404,
    ]);
    // Still waiting, and still able to finish.
    await expect(page.getByRole('status')).toBeVisible();

    tmdb.approve(requestToken);
    await comeBack(redirectTo);

    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();
  });

  test('signing out ends the session at TMDB', async ({ running, tmdb }) => {
    const { page } = running;
    const { requestToken, redirectTo } = await startLogin(running);
    tmdb.approve(requestToken);
    await comeBack(redirectTo);
    await expect(page.locator(accountLink)).toHaveText(ACCOUNT.name);

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(
      page.getByRole('button', { name: 'Sign in with TMDB' }),
    ).toBeVisible();
    await expect(page.locator(accountLink)).toHaveText('Sign in');
    await expect.poll(() => tmdb.sessions()).toEqual([]);
    await expect.poll(() => tmdb.accessTokens()).toEqual([]);
  });

  test('the session stays in the main process', async ({ running, tmdb }) => {
    const { page } = running;
    const { requestToken, redirectTo } = await startLogin(running);
    tmdb.approve(requestToken);
    await comeBack(redirectTo);
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();

    const [session] = tmdb.sessions();
    const [accessToken] = tmdb.accessTokens();
    const seen = await page.evaluate(async () => ({
      auth: Object.keys(window.api?.auth ?? {}).sort(),
      state: await window.api?.auth.getSession(),
      everything: JSON.stringify([
        { ...localStorage },
        { ...sessionStorage },
        document.documentElement.outerHTML,
      ]),
    }));

    expect(session).toMatch(/^[0-9a-f]{40}$/);
    // Who signed in, and nothing that would let the page act as them.
    expect(seen.state).toEqual({
      status: 'authenticated',
      account: ACCOUNT,
      persistence: expect.any(String),
      offline: false,
    });
    expect(seen.auth).toEqual([
      'cancelLogin',
      'confirmManual',
      'getSession',
      'login',
      'logout',
      'onChange',
      'remember',
    ]);
    expect(seen.everything).not.toContain(session);
    expect(accessToken).toBeTruthy();
    expect(seen.everything).not.toContain(accessToken);
  });

  test('the search works the same, signed in or not', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    const { requestToken, redirectTo } = await startLogin(running);
    tmdb.approve(requestToken);
    await comeBack(redirectTo);
    await expect(page.locator(accountLink)).toHaveText(ACCOUNT.name);

    await openPage(page, 'search');
    await page.getByRole('searchbox').fill('matrix');
    await page.getByRole('searchbox').press('Enter');

    await expect(cards(page)).toHaveCount(20);
    expect(tmdb.lastSearch()?.credential).toBe('app');
  });
});
