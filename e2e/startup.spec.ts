import { expect, test } from './support/fixtures';

test.describe('startup', () => {
  test('the window shows the app, never the spinner of the template', async ({
    running,
  }) => {
    const { app, page } = running;

    await expect(
      page.getByRole('navigation', { name: 'Main menu' }),
    ).toBeVisible();
    // Hidden until the page painted, then shown.
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isVisible(),
        ),
      )
      .toBe(true);
    // The preload script of the template added it over the page.
    await expect(page.locator('.app-loading-wrap')).toHaveCount(0);
  });
});
