import type { Page } from '@playwright/test';
import { expect, heading, test } from './support/fixtures';

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
    expect(tmdb.lists().map(({ path, language }) => [path, language])).toEqual([
      ['/3/trending/all/week', 'en'],
      ['/3/movie/popular', 'en'],
      ['/3/tv/popular', 'en'],
    ]);
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

    await page.locator('header button:has(.pi-language)').click();
    await page.getByText('pt-BR', { exact: true }).click();

    await expect(list(page, 'Em alta na semana')).toContainText(
      'Movie 1 [pt-BR]',
    );
    expect(tmdb.lists().at(-1)?.language).toBe('pt-BR');
  });
});
