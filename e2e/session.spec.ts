import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ACCOUNT, type FakeTmdb } from './support/fake-tmdb';
import { expect, openPage, test, type RunningApp } from './support/fixtures';
import { accountLink, signIn } from './support/login';

// The tests run the app on Linux without a keyring (support/fixtures.ts),
// so there it asks before keeping a session. Elsewhere it never asks.
const withoutKeyring = process.platform === 'linux';

/** The files in which the app keeps a session for the next launch. */
const sessionFiles = async (userDataDir: string) =>
  (await readdir(userDataDir)).filter((name) =>
    name.startsWith('tmdb-session.'),
  );

/** Signs in and keeps the session for the next launch, as a user would. */
async function signInToStay(running: RunningApp, tmdb: FakeTmdb) {
  const { page } = running;

  await openPage(page, 'account');
  await signIn(running, tmdb);

  if (withoutKeyring) {
    await page.getByRole('button', { name: 'Keep me signed in' }).click();
    await expect(
      page.getByText('the sign-in is saved without encryption'),
    ).toBeVisible();
  }
}

const accountChecks = (tmdb: FakeTmdb) =>
  tmdb.requests.filter((request) => request.path === '/3/account').length;

test.describe('staying signed in', () => {
  test('a restart keeps the user signed in, with the same session', async ({
    running,
    launchApp,
    tmdb,
    userDataDir,
  }) => {
    await signInToStay(running, tmdb);
    const [session] = tmdb.sessions();
    await running.app.close();

    // On disk, but not as text that anyone could read and use.
    const files = await sessionFiles(userDataDir);
    expect(files).toEqual(['tmdb-session.bin']);
    expect(await readFile(join(userDataDir, files[0]), 'latin1')).not.toContain(
      session,
    );

    const { page } = await launchApp();

    await expect(page.locator(accountLink)).toHaveText(ACCOUNT.name);
    // Asked TMDB once more: at the login, and now to confirm it.
    await expect.poll(() => accountChecks(tmdb)).toBe(2);
    await openPage(page, 'account');
    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(tmdb.sessions()).toEqual([session]);
  });

  test('without a keyring, nothing is kept unless the user agrees', async ({
    running,
    launchApp,
    tmdb,
    userDataDir,
  }) => {
    test.skip(!withoutKeyring, 'Only Linux runs the tests without a keyring');

    await openPage(running.page, 'account');
    await signIn(running, tmdb);
    await expect(
      running.page.getByText('only until the app is closed'),
    ).toBeVisible();
    await running.app.close();

    expect(await sessionFiles(userDataDir)).toEqual([]);

    const { page } = await launchApp();

    await expect(page.locator(accountLink)).toHaveText('Sign in');
  });

  test('a session ended on the TMDB website signs the user out at the next launch', async ({
    running,
    launchApp,
    tmdb,
    userDataDir,
  }) => {
    await signInToStay(running, tmdb);
    await running.app.close();
    tmdb.endSessions();

    const { page } = await launchApp();

    await expect(page.locator(accountLink)).toHaveText('Sign in');
    await expect.poll(() => sessionFiles(userDataDir)).toEqual([]);
  });

  test('without a connection at launch, the user stays signed in', async ({
    running,
    launchApp,
    tmdb,
    userDataDir,
  }) => {
    await signInToStay(running, tmdb);
    await running.app.close();
    tmdb.goOffline();

    const { page } = await launchApp();
    await openPage(page, 'account');

    await expect(page.getByText(`Signed in as ${ACCOUNT.name}`)).toBeVisible();
    await expect(page.getByRole('status')).toContainText(
      'TMDB could not be reached, so your account was not checked',
    );
    expect(await sessionFiles(userDataDir)).toHaveLength(1);
  });

  test('signing out forgets the saved session', async ({
    running,
    launchApp,
    tmdb,
    userDataDir,
  }) => {
    await signInToStay(running, tmdb);

    await running.page.getByRole('button', { name: 'Sign out' }).click();

    await expect(running.page.locator(accountLink)).toHaveText('Sign in');
    await expect.poll(() => sessionFiles(userDataDir)).toEqual([]);
    await running.app.close();

    const { page } = await launchApp();

    await expect(page.locator(accountLink)).toHaveText('Sign in');
    expect(tmdb.sessions()).toEqual([]);
  });
});
