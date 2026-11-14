import { REJECTED_KEY, VALID_KEY } from './support/fake-tmdb';
import {
  cards,
  expect,
  openPage,
  saveKey,
  searchBox,
  test,
} from './support/fixtures';

const keyInput = 'input[type="password"]';

test.describe('TMDB key', () => {
  test('a search without a key explains it and leads to the home page', async ({
    page,
    tmdb,
  }) => {
    await openPage(page, 'search');
    await searchBox(page).fill('matrix');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(
      'The TMDB API key is missing or invalid.',
    );
    expect(tmdb.searches()).toHaveLength(0);

    await alert.getByRole('link').click();

    await expect(page).toHaveURL(/#\/home$/);
  });

  test('text that is not a key is refused', async ({ page }) => {
    await saveKey(page, 'not a key');

    await expect(page.getByRole('alert')).toHaveText(
      'This does not look like a TMDB key.',
    );
    await expect(page.locator(keyInput)).toBeEnabled();
  });

  test('a key that TMDB rejects is reported on the search page', async ({
    page,
  }) => {
    await saveKey(page, REJECTED_KEY);
    await openPage(page, 'search');
    await searchBox(page).fill('matrix');

    await expect(page.getByRole('alert')).toContainText(
      'The TMDB API key is missing or invalid.',
    );
    await expect(cards(page)).toHaveCount(0);
  });

  test('a saved key survives a restart and is never shown again', async ({
    running,
    launchApp,
  }) => {
    await saveKey(running.page, VALID_KEY);
    await expect(running.page.locator(keyInput)).toBeDisabled();
    await running.app.close();

    const { page } = await launchApp();

    await expect(page.locator(keyInput)).toBeDisabled();
    await expect(page.locator(keyInput)).toHaveValue('');
    expect(await page.content()).not.toContain(VALID_KEY);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage })),
    ).not.toContain(VALID_KEY);

    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await expect(cards(page)).toHaveCount(20);
  });

  test('a key left in localStorage by an older version is moved', async ({
    running,
    launchApp,
  }) => {
    await running.page.evaluate(
      (key) => localStorage.setItem('api_key', key),
      VALID_KEY,
    );
    await running.app.close();

    const { page } = await launchApp();

    await expect(page.locator(keyInput)).toBeDisabled();
    expect(
      await page.evaluate(() => localStorage.getItem('api_key')),
    ).toBeNull();

    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await expect(cards(page)).toHaveCount(20);
  });

  test('a removed key is gone', async ({ page }) => {
    await saveKey(page, VALID_KEY);
    await expect(page.locator(keyInput)).toBeDisabled();

    await page.locator('button:has(.pi-trash)').click();
    await expect(page.locator(keyInput)).toBeEnabled();

    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await expect(page.getByRole('alert')).toContainText(
      'The TMDB API key is missing or invalid.',
    );
  });
});
