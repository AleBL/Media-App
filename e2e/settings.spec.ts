import {
  cards,
  expect,
  heading,
  openPage,
  searchBox,
  test,
} from './support/fixtures';

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, 'settings');
  });

  test('shows where to watch in the country chosen', async ({ page }) => {
    await page.getByLabel('Country').selectOption({ label: 'Brazil' });

    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await cards(page).first().getByRole('link').click();

    await expect(heading(page)).toHaveText('Movie 1 [en] (2020)');
    await expect(
      page.getByRole('heading', { name: 'Where to watch in Brazil' }),
    ).toBeVisible();
  });

  test('changes the language, and the theme of the window with the app', async ({
    running,
  }) => {
    const { page, app } = running;

    await page.getByRole('radio', { name: 'Dark' }).check();

    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect
      .poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource))
      .toBe('dark');

    await page
      .getByLabel('Language')
      .selectOption({ label: 'Português (Brasil)' });

    await expect(heading(page)).toHaveText('Configurações');
  });

  test('clears the cache: the genres are asked from TMDB again', async ({
    page,
    tmdb,
  }) => {
    const genreRequests = () =>
      tmdb.requests.filter(({ path }) => path === '/3/genre/movie/list').length;
    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await expect(cards(page).first()).toContainText('Action');
    const before = genreRequests();

    await openPage(page, 'settings');
    await page.getByRole('button', { name: 'Clear cache' }).click();

    await expect(page.getByRole('status')).toHaveText('Cache cleared.');

    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await expect(cards(page).first()).toContainText('Action');
    expect(genreRequests()).toBe(before + 1);
  });
});
