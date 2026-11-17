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
});
