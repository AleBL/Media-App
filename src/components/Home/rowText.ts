import type { MediaList } from '@shared/api';
import { choiceOf, type HomeRow } from '@/stores/homeRows';
import { languageIn } from '@/util/region';

type Translate = (key: string, values?: Record<string, unknown>) => string;

const LIST_TITLES: Record<MediaList, string> = {
  trending: 'homePage.trending',
  // The same row, with the type chosen on the page.
  'trending-movies': 'homePage.trending',
  'trending-tv': 'homePage.trending',
  'popular-movies': 'homePage.popularMovies',
  'popular-tv': 'homePage.popularTv',
  'now-playing': 'homePage.nowPlaying',
};

/**
 * The title of a row: the name of a list, or what a choice of the Explore
 * page shows, such as "Popular TV shows: Drama, Crime". `genreNames` gives
 * the names of the genres in the language of the app ('' until known).
 */
export function rowTitle(
  row: HomeRow,
  t: Translate,
  genreNames: (ids: number[]) => string,
): string {
  if ('list' in row) {
    return t(LIST_TITLES[row.list]);
  }

  const { type, sort, genres } = choiceOf(row);
  const title = t(`homePage.${sort}.${type}`);
  const names = genres.length ? genreNames(genres) : '';

  return names ? t('homePage.withGenres', { title, genres: names }) : title;
}

/**
 * The other filters of a choice, under its title, such as
 * "1990s · Rating 7+ · Up to 14 · Korean · On my services".
 */
export function rowDetails(
  row: HomeRow,
  t: Translate,
  locale: string,
): string[] {
  if ('list' in row) {
    return [];
  }

  const choice = choiceOf(row);
  const { fromYear: from, toYear: to } = choice;
  const parts: string[] = [];

  if (from && to) {
    parts.push(
      from === to
        ? String(from)
        : from % 10 === 0 && to === from + 9
          ? t('discover.decade', { decade: from })
          : t('homePage.years', { from, to }),
    );
  } else if (from) {
    parts.push(t('homePage.since', { year: from }));
  } else if (to) {
    parts.push(t('homePage.until', { year: to }));
  }

  if (choice.minRating) {
    parts.push(t('homePage.ratingAtLeast', { n: choice.minRating }));
  }

  if (choice.ageRating) {
    parts.push(t('homePage.ageUpTo', { code: choice.ageRating }));
  }

  if (choice.originalLanguage) {
    parts.push(languageIn(choice.originalLanguage, locale));
  }

  if (choice.mine) {
    parts.push(t('discover.myServices'));
  }

  return parts;
}
