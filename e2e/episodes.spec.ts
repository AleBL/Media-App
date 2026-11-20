import type { Page } from '@playwright/test';
import {
  cards,
  expect,
  heading,
  openPage,
  searchBox,
  test,
} from './support/fixtures';
import { signIn } from './support/login';

/** The day of the user, as the app writes it: YYYY-MM-DD. */
const today = () => new Date().toLocaleDateString('sv-SE');

/** What the list of episodes has, each change by its day, without the time. */
const byDay = (kept: Record<string, string | null> | null) =>
  kept &&
  Object.fromEntries(
    Object.entries(kept).map(([title, comment]) => [
      title,
      comment?.replace(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2};/, '$1;') ?? null,
    ]),
  );

/** Signed in, on the page of the first show a search finds. */
async function openShow({ page }: { page: Page }) {
  await openPage(page, 'search');
  await page.getByRole('radio', { name: 'TV Show' }).check();
  await searchBox(page).fill('office');
  await cards(page).first().getByRole('link').click();
  await expect(heading(page)).toHaveText('Show 1 [en] (2008)');
}

const watchedEpisode = (page: Page, code: string) =>
  page.getByRole('button', { name: `Watched: ${code}` });

// The episodes watched go in a second private list of the account (v4),
// each show with its episodes in the comment. Every episode out (8 in the
// first season, 5 in the second) marks the show watched too.
test.describe('episodes watched', () => {
  test.beforeEach(async ({ running, tmdb }) => {
    await openPage(running.page, 'account');
    await signIn(running, tmdb);
    await openShow(running);
  });

  test('marks episodes one by one, up to one, and a season, in a list of their own', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    await page
      .getByRole('region', { name: 'Seasons' })
      .getByRole('link', { name: 'Season 1 [en]' })
      .click();
    await expect(heading(page)).toHaveText('Season 1 [en]');
    // reading made no list
    expect(tmdb.userLists()).toEqual([]);

    await watchedEpisode(page, 'S1 E1').click();

    await expect(watchedEpisode(page, 'S1 E1')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect
      .poll(() => byDay(tmdb.episodes()))
      .toEqual({ 'tv:9001': `${today()};1:1` });
    await expect
      .poll(() => tmdb.userLists())
      .toEqual([
        {
          name: 'MoviLedger: episodes',
          public: false,
          sortBy: 'original_order.desc',
        },
      ]);
    await expect(page.getByText('1 of 8 watched')).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Mark every episode up to S1 E3 as watched',
      })
      .click();

    await expect
      .poll(() => byDay(tmdb.episodes()))
      .toEqual({ 'tv:9001': `${today()};1:1-3` });
    await expect(
      page.getByText('Episodes up to S1 E3 marked as watched.', {
        exact: true,
      }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Undo' }).click();

    await expect
      .poll(() => byDay(tmdb.episodes()))
      .toEqual({ 'tv:9001': `${today()};1:1` });
    await expect(watchedEpisode(page, 'S1 E3')).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await page.getByRole('button', { name: 'Mark season watched' }).click();

    await expect(page.getByText('8 of 8 watched')).toBeVisible();
    await expect
      .poll(() => byDay(tmdb.episodes()))
      .toEqual({ 'tv:9001': `${today()};1:1-8` });
    // a season of two: the show is not watched yet
    expect(tmdb.watched()).toBeNull();
  });

  test('marks the show watched with its last episode, and unmarks it with one taken away', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    await page
      .getByRole('region', { name: 'Seasons' })
      .getByRole('link', { name: 'Season 2 [en]' })
      .click();
    await expect(heading(page)).toHaveText('Season 2 [en]');

    // the first season too, without the specials
    await page
      .getByRole('button', {
        name: 'Mark every episode up to S2 E5 as watched',
      })
      .click();

    await expect
      .poll(() => byDay(tmdb.episodes()))
      .toEqual({ 'tv:9001': `${today()};1:1-8;2:1-5` });
    await expect.poll(() => tmdb.watched()).toEqual({ 'tv:9001': today() });

    await page.getByRole('button', { name: 'Back to Show 1 [en]' }).click();

    const seasons = page.getByRole('region', { name: 'Seasons' });
    await expect(seasons).toContainText('13 of 13 episodes watched');
    await expect(
      page.getByRole('button', { name: 'Watched', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');

    await seasons.getByRole('link', { name: 'Season 2 [en]' }).click();
    await watchedEpisode(page, 'S2 E5').click();

    await expect.poll(() => tmdb.watched()).toEqual({});
    await expect
      .poll(() => byDay(tmdb.episodes()))
      .toEqual({ 'tv:9001': `${today()};1:1-8;2:1-4` });
  });

  test('goes on from the home page with the next episode, and lists the show in progress', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    await page
      .getByRole('region', { name: 'Seasons' })
      .getByRole('link', { name: 'Season 1 [en]' })
      .click();
    await page
      .getByRole('button', {
        name: 'Mark every episode up to S1 E3 as watched',
      })
      .click();
    await expect
      .poll(() => byDay(tmdb.episodes()))
      .toEqual({ 'tv:9001': `${today()};1:1-3` });

    await openPage(page, 'home');

    const row = page.getByRole('region', { name: 'Continue watching' });
    await expect(row).toContainText('Show 1 [en]');
    await expect(row).toContainText('S1 E4 · Episode 4 [en]');
    await expect(row).toContainText('3 of 13 episodes watched');

    await row
      .getByRole('button', { name: 'Mark S1 E4 of Show 1 [en] as watched' })
      .click();

    await expect(row).toContainText('S1 E5 · Episode 5 [en]');
    await expect
      .poll(() => byDay(tmdb.episodes()))
      .toEqual({ 'tv:9001': `${today()};1:1-4` });

    // the card leads to the season of the episode
    await row.getByRole('link', { name: 'Show 1 [en]' }).click();
    await expect(heading(page)).toHaveText('Season 1 [en]');

    await openPage(page, 'watched');

    const inProgress = page.getByRole('region', { name: 'In progress' });
    await expect(inProgress).toContainText('S1 E5 · Episode 5 [en]');
  });

  test('marks every episode out with the button of the show, and takes them away', async ({
    running,
    tmdb,
  }) => {
    const { page } = running;
    const watched = page.getByRole('button', { name: 'Watched', exact: true });

    await watched.click();

    await expect(watched).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() => byDay(tmdb.episodes()))
      .toEqual({ 'tv:9001': `${today()};1:1-8;2:1-5` });
    await expect(page.getByText('13 of 13 episodes watched')).toBeVisible();

    await watched.click();

    await expect(watched).toHaveAttribute('aria-pressed', 'false');
    // no episode left: the show leaves the list
    await expect.poll(() => byDay(tmdb.episodes())).toEqual({});
    await expect.poll(() => tmdb.watched()).toEqual({});
  });
});
