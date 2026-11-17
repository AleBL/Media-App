import type { Page } from '@playwright/test';
import { REJECTED_KEY, VALID_KEY } from './support/fake-tmdb';
import {
  cards,
  expect,
  keyInput,
  openPage,
  removeKey,
  saveKey,
  searchBox,
  test,
} from './support/fixtures';

async function search(page: Page) {
  await openPage(page, 'search');
  await searchBox(page).fill('matrix');
}

test.describe('TMDB credential', () => {
  test('a clean install searches without any setup', async ({ page, tmdb }) => {
    await page.getByRole('link', { name: 'Start searching' }).click();
    await expect(page).toHaveURL(/#\/search$/);
    await searchBox(page).fill('matrix');

    await expect(cards(page)).toHaveCount(20);
    expect(tmdb.lastSearch()?.credential).toBe('app');

    await openPage(page, 'settings');

    await expect(page.getByText('so this is optional')).toBeVisible();
    await expect(keyInput(page)).toBeEnabled();
    await expect(keyInput(page)).toHaveValue('');
  });

  test('text that is not a key is refused', async ({ page }) => {
    await saveKey(page, 'not a key');

    await expect(page.getByRole('alert')).toHaveText(
      'This does not look like a TMDB key.',
    );
    await expect(keyInput(page)).toBeEnabled();
  });

  test('a key of the user is used instead of the credential of the app', async ({
    page,
    tmdb,
  }) => {
    await saveKey(page, VALID_KEY);
    await expect(keyInput(page)).toBeDisabled();

    await search(page);

    await expect(cards(page)).toHaveCount(20);
    expect(tmdb.lastSearch()?.credential).toBe('user');
  });

  test('a key that TMDB rejects is reported, and removing it brings the search back', async ({
    page,
    tmdb,
  }) => {
    await saveKey(page, REJECTED_KEY);
    await expect(keyInput(page)).toBeDisabled();
    await search(page);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('TMDB refused your key.');
    await expect(cards(page)).toHaveCount(0);

    await alert.getByRole('link').click();
    await expect(page).toHaveURL(/#\/settings$/);
    await removeKey(page);
    await openPage(page, 'search');

    // The search page asks again by itself, now with the app's credential.
    await expect(cards(page)).toHaveCount(20);
    expect(tmdb.lastSearch()?.credential).toBe('app');
  });

  test('when TMDB refuses the app, a key of the user gets the search working', async ({
    page,
    tmdb,
  }) => {
    tmdb.revokeAppToken();
    await search(page);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText("TMDB refused the app's access.");
    await expect(cards(page)).toHaveCount(0);

    await alert.getByRole('link').click();
    await expect(page).toHaveURL(/#\/settings$/);
    await saveKey(page, VALID_KEY);
    await expect(keyInput(page)).toBeDisabled();
    await openPage(page, 'search');

    await expect(cards(page)).toHaveCount(20);
    expect(tmdb.lastSearch()?.credential).toBe('user');
  });

  test('a saved key survives a restart and is never shown again', async ({
    running,
    launchApp,
    tmdb,
  }) => {
    await saveKey(running.page, VALID_KEY);
    await expect(keyInput(running.page)).toBeDisabled();
    await running.app.close();

    const { page } = await launchApp();
    await openPage(page, 'settings');

    await expect(keyInput(page)).toBeDisabled();
    await expect(keyInput(page)).toHaveValue('');
    expect(await page.content()).not.toContain(VALID_KEY);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage })),
    ).not.toContain(VALID_KEY);

    await search(page);

    await expect(cards(page)).toHaveCount(20);
    expect(tmdb.lastSearch()?.credential).toBe('user');
  });

  test('a key left in localStorage by an older version is dropped', async ({
    running,
    launchApp,
    tmdb,
  }) => {
    await running.page.evaluate(
      (key) => localStorage.setItem('api_key', key),
      VALID_KEY,
    );
    await running.app.close();

    const { page } = await launchApp();

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('api_key')))
      .toBeNull();

    // It did not become a saved key: the app's own credential is enough.
    await openPage(page, 'settings');
    await expect(keyInput(page)).toBeEnabled();

    await search(page);

    await expect(cards(page)).toHaveCount(20);
    expect(tmdb.lastSearch()?.credential).toBe('app');
  });
});
