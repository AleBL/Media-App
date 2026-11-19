import type { LocationQuery, LocationQueryRaw } from 'vue-router';
import {
  DISCOVER_SORTS,
  type DiscoverRequest,
  type DiscoverSort,
  type MediaType,
} from '@shared/api';

/**
 * What the Explore page shows, as its address keeps it
 * (#/discover?type=tv&genres=18,80&from=1990&to=1999&mine=1): reloading,
 * going back and a link find the same titles.
 */
export interface DiscoverChoice {
  type: MediaType;
  sort: DiscoverSort;
  /** Titles with all of them. */
  genres: number[];
  fromYear?: number;
  toYear?: number;
  minRating?: number;
  originalLanguage?: string;
  /** An age rating of the country of the settings, and the milder ones. */
  ageRating?: string;
  /** Only what is on the services of the user. */
  mine: boolean;
}

export const FIRST_YEAR = 1870;
export const LAST_YEAR = 2100;
export const MIN_RATINGS = [6, 7, 8] as const;
const MAX_GENRES = 10;
const AGE_RATING = /^[\p{L}\p{N}+\-/. ]{1,12}$/u;
const LANGUAGE_CODE = /^[a-z]{2}$/;

const text = (value: LocationQuery[string]) =>
  typeof value === 'string' ? value : undefined;

function year(value: LocationQuery[string]) {
  const number = Number(text(value));

  return Number.isInteger(number) && number >= FIRST_YEAR && number <= LAST_YEAR
    ? number
    : undefined;
}

/** The choice in an address, leaving out what is not one. */
export function readChoice(query: LocationQuery): DiscoverChoice {
  const type = text(query.type) === 'tv' ? 'tv' : 'movie';
  const sort = text(query.sort);
  const genres = (text(query.genres) ?? '')
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  let fromYear = year(query.from);
  let toYear = year(query.to);
  const rating = Number(text(query.rating));
  const language = text(query.original);
  const age = text(query.age);

  if (fromYear && toYear && fromYear > toYear) {
    [fromYear, toYear] = [toYear, fromYear];
  }

  return {
    type,
    sort: DISCOVER_SORTS.includes(sort as DiscoverSort)
      ? (sort as DiscoverSort)
      : 'popularity',
    genres: [...new Set(genres)].slice(0, MAX_GENRES),
    fromYear,
    toYear,
    minRating:
      Number.isInteger(rating) && rating >= 1 && rating <= 9
        ? rating
        : undefined,
    originalLanguage:
      language && LANGUAGE_CODE.test(language) ? language : undefined,
    ageRating: age && AGE_RATING.test(age) ? age : undefined,
    mine: text(query.mine) === '1',
  };
}

/** The address of a choice, without what is as it starts. */
export function toQuery(choice: DiscoverChoice): LocationQueryRaw {
  return {
    ...(choice.type !== 'movie' && { type: choice.type }),
    ...(choice.sort !== 'popularity' && { sort: choice.sort }),
    ...(choice.genres.length > 0 && { genres: choice.genres.join(',') }),
    ...(choice.fromYear && { from: String(choice.fromYear) }),
    ...(choice.toYear && { to: String(choice.toYear) }),
    ...(choice.minRating && { rating: String(choice.minRating) }),
    ...(choice.originalLanguage && { original: choice.originalLanguage }),
    ...(choice.ageRating && { age: choice.ageRating }),
    ...(choice.mine && { mine: '1' }),
  };
}

/**
 * How many filters are in use, besides the type and the order. `mine`
 * counts only with services to show.
 */
export function filtersInUse(choice: DiscoverChoice, mine: boolean): number {
  return [
    choice.genres.length > 0,
    !!(choice.fromYear || choice.toYear),
    !!choice.minRating,
    !!choice.ageRating,
    !!choice.originalLanguage,
    mine,
  ].filter(Boolean).length;
}

/**
 * What to ask TMDB for a choice, in a language and a country, on the
 * services given (none: on any). Built in the same order every time, which
 * tells two apart by their JSON.
 */
export function toDiscovery(
  choice: DiscoverChoice,
  where: { language: string; region: string; providers: number[] },
): Omit<DiscoverRequest, 'page'> {
  const { type, sort, genres, fromYear, toYear, minRating } = choice;
  const { originalLanguage, ageRating } = choice;

  return {
    type,
    language: where.language,
    region: where.region,
    sort,
    ...(genres.length > 0 && { genres }),
    ...(fromYear && { fromYear }),
    ...(toYear && { toYear }),
    ...(minRating && { minRating }),
    ...(originalLanguage && { originalLanguage }),
    ...(ageRating && { ageRating }),
    ...(where.providers.length > 0 && {
      providers: [...where.providers].sort((a, b) => a - b),
    }),
  };
}

/** The same type and order, and nothing else. */
export const withoutFilters = (choice: DiscoverChoice): DiscoverChoice => ({
  type: choice.type,
  sort: choice.sort,
  genres: [],
  mine: false,
});
