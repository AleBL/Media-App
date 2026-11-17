import { expect, openPage, test } from './support/fixtures';

test.describe('about', () => {
  test('names TMDB as the source, with its logo and its notice', async ({
    running,
  }) => {
    const { page, openedInBrowser } = running;
    await openPage(page, 'about');

    const tmdb = page.getByRole('region', {
      name: 'Where the data comes from',
    });

    await expect(tmdb).toContainText(
      'This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.',
    );

    // Shown under the Content-Security-Policy of the window
    const logo = tmdb.getByRole('img', { name: 'The Movie Database (TMDB)' });

    await expect
      .poll(() =>
        logo.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);

    await logo.click();

    await expect.poll(openedInBrowser).toEqual(['https://www.themoviedb.org/']);
  });

  test('shows the versions in their own font', async ({ running }) => {
    const { page } = running;
    await openPage(page, 'about');
    await expect(page.locator('.waviy').first()).toBeVisible();

    // Loaded from the app itself, under the Content-Security-Policy
    await expect
      .poll(() =>
        page.evaluate(async () => {
          await document.fonts.ready;

          const statuses: string[] = [];

          document.fonts.forEach(({ family, status }) => {
            if (family.replace(/"/g, '') === 'Alfa Slab One') {
              statuses.push(status);
            }
          });

          return statuses;
        }),
      )
      .toContain('loaded');
  });

  // The terms forbid suggesting that TMDB made or endorses the app.
  test('the window has the name of the app alone', async ({ running }) => {
    const { app, page } = running;

    await expect(page).toHaveTitle('Media App');
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].getTitle(),
      ),
    ).toBe('Media App');
  });
});
