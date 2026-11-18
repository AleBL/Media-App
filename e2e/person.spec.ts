import { MISSING_MOVIE } from './support/fake-tmdb';
import {
  cards,
  chooseLanguage,
  expect,
  heading,
  openPage,
  searchBox,
  test,
} from './support/fixtures';

test.describe('page of a person', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, 'search');
    await searchBox(page).fill('matrix');
    await cards(page).first().getByRole('link').click();
    await expect(heading(page)).toHaveText('Movie 1 [en] (2020)');
  });

  test('opens from the cast of a title, with who they are and what they did', async ({
    page,
    running,
  }) => {
    await page.getByRole('link', { name: 'Ada Actor' }).click();

    await expect(page).toHaveURL(/#\/person\/1$/);
    await expect(heading(page)).toHaveText('Ada Actor');
    await expect(page.getByText('May 20, 1970')).toBeVisible();
    await expect(page.getByText('Lisbon, Portugal')).toBeVisible();

    // the start of the biography, and all of it when asked
    const more = page.getByRole('button', { name: 'Read more' });
    const biography = page.locator('#person-biography');
    const cutShort = () =>
      biography.evaluate((text) => text.scrollHeight > text.clientHeight);
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(await cutShort()).toBe(true);
    await more.click();
    await expect.poll(cutShort).toBe(false);
    await expect(
      page.getByRole('button', { name: 'Read less' }),
    ).toHaveAttribute('aria-expanded', 'true');

    // the best known first, each title once with both roles, the talk
    // show last although it has more votes
    const credits = page
      .getByRole('region', { name: 'Filmography' })
      .getByRole('article');
    await expect(credits).toHaveCount(3);
    await expect(credits.nth(0)).toContainText('Movie 1 [en] (2020)');
    await expect(credits.nth(0)).toContainText('Hero / Twin');
    await expect(credits.nth(1)).toContainText('Show 1 [en] (2008)');
    await expect(credits.nth(2)).toContainText('Talk Show [en] (2015)');

    await page.getByRole('link', { name: 'See on IMDb' }).click();
    await page.getByRole('link', { name: 'Instagram' }).click();
    await expect
      .poll(running.openedInBrowser)
      .toEqual([
        'https://www.imdb.com/name/nm0000001/',
        'https://www.instagram.com/ada.actor/',
      ]);
  });

  test('shows what they did behind the camera, still chosen after a title', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Ada Actor' }).click();
    await page.getByRole('radio', { name: 'Behind the camera (1)' }).check();

    await expect(page).toHaveURL(/#\/person\/1\?role=crew$/);
    const credits = page
      .getByRole('region', { name: 'Filmography' })
      .getByRole('article');
    await expect(credits).toHaveCount(1);
    await expect(credits.first()).toContainText('Movie 3 [en] (2024)');
    await expect(credits.first()).toContainText('Directing, Writing');

    await credits.first().getByRole('link').click();
    await expect(heading(page)).toHaveText('Movie 3 [en] (2020)');
    await page.goBack();

    await expect(heading(page)).toHaveText('Ada Actor');
    await expect(
      page.getByRole('radio', { name: 'Behind the camera (1)' }),
    ).toBeChecked();
  });

  test('shows the biography in English when TMDB has none in the language', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Ada Actor' }).click();
    await expect(heading(page)).toHaveText('Ada Actor');

    await chooseLanguage(page, 'Português (Brasil)');

    await expect(
      page.getByText('O TMDB só tem esta biografia em inglês.'),
    ).toBeVisible();
    await expect(page.locator('#person-biography')).toHaveAttribute(
      'lang',
      'en',
    );
    await expect(page.getByText('Movie 1 [pt-BR] (2020)')).toBeVisible();
  });

  test('says so when TMDB does not have the person', async ({ page }) => {
    await page.evaluate(
      (id) => (location.hash = `#/person/${id}`),
      MISSING_MOVIE,
    );

    await expect(page.getByRole('alert')).toContainText(
      'This person was not found on TMDB.',
    );
  });
});
