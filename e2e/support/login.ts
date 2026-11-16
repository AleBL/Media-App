import { ACCOUNT, wayBackOf, type FakeTmdb } from './fake-tmdb';
import { expect, type RunningApp } from './fixtures';

/**
 * The item of the menu for the account: "Sign in", or the name of whoever
 * signed in, on the button of their own menu.
 */
export const accountLink =
  'header nav > ul > li > :is(a[href$="#/account"], button[aria-controls="account-menu"])';

/**
 * Presses the button and takes apart the page the app asked the browser to
 * open. The tests never open it: what a person does there is `tmdb.approve`.
 * The app signs in through TMDB v4, whose request token keeps the way back,
 * or through v3 with a key of the user, where the address of the page does.
 */
export async function startLogin(
  running: RunningApp,
  button = 'Sign in with TMDB',
) {
  const { page, openedInBrowser } = running;
  const before = (await openedInBrowser()).length;

  await page.getByRole('button', { name: button }).click();
  await expect
    .poll(async () => (await openedInBrowser()).length)
    .toBe(before + 1);

  const url = new URL((await openedInBrowser()).at(-1)!);

  if (url.pathname.startsWith('/authenticate/')) {
    return {
      url,
      requestToken: url.pathname.split('/').at(-1)!,
      redirectTo: url.searchParams.get('redirect_to')!,
    };
  }

  const requestToken = url.searchParams.get('request_token')!;

  return { url, requestToken, redirectTo: wayBackOf(requestToken) };
}

/**
 * What TMDB makes the browser do once the user answered on its website: go
 * to the way back (v3 adds the answer to it, which the app does not read).
 */
export const comeBack = (redirectTo: string) => fetch(redirectTo);

/** Signs in from the account page, approving on the "TMDB website". */
export async function signIn(running: RunningApp, tmdb: FakeTmdb) {
  const { requestToken, redirectTo } = await startLogin(running);

  tmdb.approve(requestToken);
  await comeBack(redirectTo);
  await expect(running.page.locator(accountLink)).toHaveText(ACCOUNT.name);
}
