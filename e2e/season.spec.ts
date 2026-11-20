import { SEASON_ONE_EPISODES } from './support/fake-tmdb';
import {
  cards,
  chooseLanguage,
  expect,
  heading,
  openPage,
  searchBox,
  test,
} from './support/fixtures';

// The seasons of a show and the page of each one, with its episodes.
test.describe('seasons of a show', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, 'search');
    await page.getByRole('radio', { name: 'TV Show' }).check();
    await searchBox(page).fill('office');
    await cards(page).first().getByRole('link').click();
    await expect(heading(page)).toHaveText('Show 1 [en] (2008)');
  });

  test('opens a season from its show, with its episodes, and the others from it', async ({
    page,
  }) => {
    const seasons = page.getByRole('region', { name: 'Seasons' });

    // in order, the specials last, and not the one announced without episodes
    await expect(seasons.getByRole('link')).toHaveText([
      'Season 1 [en]',
      'Season 2 [en]',
      'Specials [en]',
    ]);
    await expect(seasons).toContainText(
      'Next episode: S3 E1 · Back, January 15, 2027',
    );

    await seasons.getByRole('link', { name: 'Season 1 [en]' }).click();

    await expect(page).toHaveURL(/#\/tv\/9001\/season\/1$/);
    await expect(heading(page)).toHaveText('Season 1 [en]');
    const episodes = page
      .getByRole('region', { name: 'Episodes' })
      .getByRole('listitem');
    await expect(episodes).toHaveCount(SEASON_ONE_EPISODES);
    await expect(episodes.first()).toContainText('S1 E1 · Episode 1 [en]');
    await expect(episodes.first()).toContainText('47 min');
    await expect(episodes.last()).toContainText('Season finale');

    await page.getByRole('link', { name: 'Next season' }).click();
    await expect(page).toHaveURL(/#\/tv\/9001\/season\/2$/);
    await expect(heading(page)).toHaveText('Season 2 [en]');

    await page.getByLabel('Season', { exact: true }).selectOption('0');
    await expect(page).toHaveURL(/#\/tv\/9001\/season\/0$/);

    await page.getByRole('button', { name: 'Back to Show 1 [en]' }).click();
    await expect(page).toHaveURL(/#\/tv\/9001\/season\/2$/);
  });

  test('completes in English the synopsis TMDB lacks in the language', async ({
    page,
    tmdb,
  }) => {
    await page
      .getByRole('region', { name: 'Seasons' })
      .getByRole('link', { name: 'Season 1 [en]' })
      .click();
    await expect(heading(page)).toHaveText('Season 1 [en]');

    await chooseLanguage(page, 'Português (Brasil)');

    const second = page
      .getByRole('region', { name: 'Episódios' })
      .getByRole('listitem')
      .nth(1);
    await expect(second).toContainText('T1 E2 · Episode 2 [pt-BR]');
    await expect(second).toContainText('Episode 2, told in en-US.');
    await expect(second).toContainText('O TMDB só tem esta sinopse em inglês.');
    // the language and English go together, in either order
    const [first, ...again] = tmdb.requests
      .filter(({ path }) => path === '/3/tv/9001/season/1')
      .map(({ language }) => language);
    expect(first).toBe('en');
    expect(again.sort()).toEqual(['en-US', 'pt-BR']);
  });

  test('says when TMDB does not have the season, leading to the show', async ({
    page,
  }) => {
    await page.evaluate(() => (location.hash = '#/tv/9001/season/7'));

    await expect(page.getByRole('alert')).toContainText(
      'This season was not found on TMDB.',
    );
    await page.getByRole('link', { name: 'Go to the show' }).click();
    await expect(heading(page)).toHaveText('Show 1 [en] (2008)');
  });
});
