import { ACCOUNT } from './support/fake-tmdb';
import { expect, openPage, test, type RunningApp } from './support/fixtures';

const accountLink = '[data-pc-name="menubar"] a[href$="#/account"]';

/**
 * Presses the button and takes apart the page the app asked the browser to
 * open. The tests never open it: what a person does there is `tmdb.approve`.
 */
async function startLogin(running: RunningApp, button = 'Sign in with TMDB') {
  const { page, openedInBrowser } = running;
  const before = (await openedInBrowser()).length;

  await page.getByRole('button', { name: button }).click();
  await expect
    .poll(async () => (await openedInBrowser()).length)
    .toBe(before + 1);

  const url = new URL((await openedInBrowser()).at(-1)!);

  return {
    url,
    requestToken: url.pathname.split('/').at(-1)!,
    redirectTo: url.searchParams.get('redirect_to')!,
  };
}

/** What TMDB makes the browser do once the user answered on its website. */
const comeBack = (redirectTo: string, requestToken: string) =>
  fetch(`${redirectTo}?request_token=${requestToken}&approved=true`);

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

    // The real TMDB website, with a way back that only this computer reaches.
    expect(`${url.origin}${url.pathname}`).toBe(
      `https://www.themoviedb.org/authenticate/${requestToken}`,
    );
    expect(redirectTo).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    await expect(page.getByRole('status')).toContainText(
      'Approve the access on the TMDB page',
    );
    await expect(page.locator('#authorize-url')).toHaveValue(url.toString());

    tmdb.approve(requestToken);
    const answer = await comeBack(redirectTo, requestToken);

    expect(answer.status).toBe(200);
    expect(await answer.text()).toContain('You are signed in');
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();
    await expect(page.locator(accountLink)).toHaveText(ACCOUNT.name);
    expect(tmdb.sessions()).toHaveLength(1);
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
    const answer = await comeBack(refused.redirectTo, refused.requestToken);

    expect(await answer.text()).toContain('The sign-in was not completed');
    await expect(page.getByRole('alert')).toContainText(
      'The access was not approved on the TMDB website',
    );

    const again = await startLogin(running, 'Try again');

    expect(again.requestToken).not.toBe(refused.requestToken);
    tmdb.approve(again.requestToken);
    await comeBack(again.redirectTo, again.requestToken);

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
    await expect(comeBack(redirectTo, requestToken)).rejects.toThrow();
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
      fetch(redirectTo),
      fetch(`${redirectTo}?request_token=someone-elses&approved=true`),
      fetch(`${redirectTo}?request_token=${requestToken}`, { method: 'POST' }),
    ]);

    expect(strangers.map((answer) => answer.status)).toEqual([
      404, 404, 404, 404, 404,
    ]);
    // Still waiting, and still able to finish.
    await expect(page.getByRole('status')).toBeVisible();

    tmdb.approve(requestToken);
    await comeBack(redirectTo, requestToken);

    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();
  });

  test('signing out ends the session at TMDB', async ({ running, tmdb }) => {
    const { page } = running;
    const { requestToken, redirectTo } = await startLogin(running);
    tmdb.approve(requestToken);
    await comeBack(redirectTo, requestToken);
    await expect(page.locator(accountLink)).toHaveText(ACCOUNT.name);

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(
      page.getByRole('button', { name: 'Sign in with TMDB' }),
    ).toBeVisible();
    await expect(page.locator(accountLink)).toHaveText('Sign in');
    await expect.poll(() => tmdb.sessions()).toEqual([]);
  });

  test('the session stays in the main process', async ({ running, tmdb }) => {
    const { page } = running;
    const { requestToken, redirectTo } = await startLogin(running);
    tmdb.approve(requestToken);
    await comeBack(redirectTo, requestToken);
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();

    const [session] = tmdb.sessions();
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
    expect(seen.state).toEqual({ status: 'authenticated', account: ACCOUNT });
    expect(seen.auth).toEqual([
      'cancelLogin',
      'confirmManual',
      'getSession',
      'login',
      'logout',
      'onChange',
    ]);
    expect(seen.everything).not.toContain(session);
  });

  test('the search works the same, signed in or not', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    const { requestToken, redirectTo } = await startLogin(running);
    tmdb.approve(requestToken);
    await comeBack(redirectTo, requestToken);
    await expect(page.locator(accountLink)).toHaveText(ACCOUNT.name);

    await openPage(page, 'search');
    await page.locator('[data-pc-name="inputtext"]').fill('matrix');
    await page.locator('[data-pc-name="inputtext"]').press('Enter');

    await expect(page.locator('.card-border')).toHaveCount(20);
    expect(tmdb.lastSearch()?.credential).toBe('app');
  });
});
