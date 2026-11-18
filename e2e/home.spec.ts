import type { Page } from '@playwright/test';
import { chooseLanguage, expect, heading, test } from './support/fixtures';

/** A list of the home page, by its title. */
const list = (page: Page, title: string) =>
  page.getByRole('region', { name: title });

// The app opens on the home page, which shows the lists at once.
test.describe('home page', () => {
  test('shows what is trending and popular, without a search', async ({
    page,
    tmdb,
  }) => {
    const trending = list(page, 'Trending this week');

    await expect(trending.getByRole('article')).toHaveCount(3);
    await expect(trending.getByRole('link')).toHaveText([
      'Movie 1 [en]',
      'Show 1 [en]',
      'Movie 2 [en]',
    ]);
    // people are trending too, at TMDB, but they have no page here
    await expect(page.getByText('A Trending Person')).toHaveCount(0);
    await expect(list(page, 'Popular movies').getByRole('article')).toHaveCount(
      3,
    );
    await expect(list(page, 'Popular TV shows')).toContainText('Show 11 [en]');
    // asked at the same time, so in any order
    expect(
      tmdb
        .lists()
        .map(({ path, language }) => `${path} ${language}`)
        .sort(),
    ).toEqual([
      '/3/movie/popular en',
      '/3/trending/all/week en',
      '/3/tv/popular en',
    ]);
  });

  test('scrolls the rows sideways without the bar of the system, which has the colors of the app', async ({
    page,
  }) => {
    const row = list(page, 'Trending this week').getByRole('list').first();
    const html = page.locator('html');

    await expect(row).toHaveCSS('overflow-x', 'auto');
    await expect(row).toHaveCSS('scrollbar-width', 'none');
    await expect(html).toHaveCSS('color-scheme', 'light');
    await expect(html).toHaveCSS(
      'scrollbar-color',
      'rgb(203, 213, 225) rgba(0, 0, 0, 0)',
    );
  });

  test('opens the page of a title, and comes back to the lists', async ({
    page,
    tmdb,
  }) => {
    await list(page, 'Trending this week')
      .getByRole('link', { name: 'Show 1 [en]' })
      .click();

    await expect(page).toHaveURL(/#\/tv\/9001$/);
    await expect(heading(page)).toHaveText('Show 1 [en] (2008)');

    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page).toHaveURL(/#\/home$/);
    await expect(
      list(page, 'Trending this week').getByRole('article'),
    ).toHaveCount(3);
    // the lists were kept, not asked for again
    expect(tmdb.lists()).toHaveLength(3);
  });

  test('follows the language chosen in the menu', async ({ page, tmdb }) => {
    await expect(list(page, 'Trending this week')).toContainText(
      'Movie 1 [en]',
    );

    await chooseLanguage(page, 'Português (Brasil)');

    await expect(list(page, 'Em alta na semana')).toContainText(
      'Movie 1 [pt-BR]',
    );
    expect(tmdb.lists().at(-1)?.language).toBe('pt-BR');
  });
});
