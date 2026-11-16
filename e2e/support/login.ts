import { ACCOUNT, type FakeTmdb } from './fake-tmdb';
import { expect, type RunningApp } from './fixtures';

/** The item of the menu that leads to the account page. */
export const accountLink = 'header nav a[href$="#/account"]';

/**
 * Presses the button and takes apart the page the app asked the browser to
 * open. The tests never open it: what a person does there is `tmdb.approve`.
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

  return {
    url,
    requestToken: url.pathname.split('/').at(-1)!,
    redirectTo: url.searchParams.get('redirect_to')!,
  };
}

/** What TMDB makes the browser do once the user answered on its website. */
export const comeBack = (redirectTo: string, requestToken: string) =>
  fetch(`${redirectTo}?request_token=${requestToken}&approved=true`);

/** Signs in from the account page, approving on the "TMDB website". */
export async function signIn(running: RunningApp, tmdb: FakeTmdb) {
  const { requestToken, redirectTo } = await startLogin(running);

  tmdb.approve(requestToken);
  await comeBack(redirectTo, requestToken);
  await expect(running.page.locator(accountLink)).toHaveText(ACCOUNT.name);
}
