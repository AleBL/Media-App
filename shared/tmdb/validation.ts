import {
  RATINGS,
  type AccountList,
  type AccountListRequest,
  type DetailsRequest,
  type ListRequest,
  type MarkRequest,
  type MediaList,
  type MediaType,
  type RateRequest,
  type SearchRequest,
  type SearchType,
  type TitleList,
  type TitleRequest,
  type WatchedListRequest,
  type WatchedRequest,
} from '../api';
import { TMDB_MAX_PAGES } from './client';

// Everything that arrives from the renderer, over IPC in the desktop app or
// over HTTP on the web, is checked here before it is used: whoever holds the
// TMDB credential does not trust the renderer's types.

const LANGUAGE = /^[a-z]{2}(-[A-Z]{2})?$/;
const REGION = /^[A-Z]{2}$/;
const API_KEY = /^[\w.-]{16,1024}$/;
const MAX_QUERY_LENGTH = 200;
/** TMDB ids are far below this; anything larger is not one of theirs. */
const MAX_ID = 2_147_483_647;

/** An app locale such as `en` or `pt-BR`. */
export function parseLanguage(value: unknown): string | null {
  return typeof value === 'string' && LANGUAGE.test(value) ? value : null;
}

/** A country code such as `BR`. */
export function parseRegion(value: unknown): string | null {
  return typeof value === 'string' && REGION.test(value) ? value : null;
}

const LISTS: readonly MediaList[] = [
  'trending',
  'popular-movies',
  'popular-tv',
];

export function parseListRequest(value: unknown): ListRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { list, language } = value as Record<string, unknown>;
  const locale = parseLanguage(language);

  return LISTS.includes(list as MediaList) && locale !== null
    ? { list: list as MediaList, language: locale }
    : null;
}

export function parseDetailsRequest(value: unknown): DetailsRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { type, id, language, region } = value as Record<string, unknown>;
  const locale = parseLanguage(language);
  const country = parseRegion(region);

  if (
    (type !== 'movie' && type !== 'tv') ||
    typeof id !== 'number' ||
    !Number.isInteger(id) ||
    id < 1 ||
    id > MAX_ID ||
    locale === null ||
    country === null
  ) {
    return null;
  }

  return { type, id, language: locale, region: country };
}

const SEARCH_TYPES: readonly SearchType[] = ['movie', 'tv', 'multi'];

export function parseSearchRequest(value: unknown): SearchRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { type, query, page, language } = value as Record<string, unknown>;
  const text = typeof query === 'string' ? query.trim() : '';
  const locale = parseLanguage(language);

  if (
    !SEARCH_TYPES.includes(type as SearchType) ||
    text.length === 0 ||
    text.length > MAX_QUERY_LENGTH ||
    typeof page !== 'number' ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > TMDB_MAX_PAGES ||
    locale === null
  ) {
    return null;
  }

  return { type: type as SearchType, query: text, page, language: locale };
}

const isMediaType = (value: unknown): value is MediaType =>
  value === 'movie' || value === 'tv';

const isId = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= MAX_ID;

const isPage = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= TMDB_MAX_PAGES;

const ACCOUNT_LISTS: readonly AccountList[] = ['watchlist', 'favorite'];

const isAccountList = (value: unknown): value is AccountList =>
  ACCOUNT_LISTS.includes(value as AccountList);

const isTitleList = (value: unknown): value is TitleList =>
  isAccountList(value) || value === 'rated';

/** A movie or tv show, by its id. */
export function parseTitleRequest(value: unknown): TitleRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { type, id } = value as Record<string, unknown>;

  return isMediaType(type) && isId(id) ? { type, id } : null;
}

export function parseMarkRequest(value: unknown): MarkRequest | null {
  const title = parseTitleRequest(value);

  if (!title) {
    return null;
  }

  const { list, value: inList } = value as Record<string, unknown>;

  return isAccountList(list) && typeof inList === 'boolean'
    ? { ...title, list, value: inList }
    : null;
}

/** A day of a calendar, as YYYY-MM-DD: what TMDB keeps in the comment. */
function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const day = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value);
}

export function parseWatchedRequest(value: unknown): WatchedRequest | null {
  const title = parseTitleRequest(value);

  if (!title) {
    return null;
  }

  const { value: watched, date, language } = value as Record<string, unknown>;
  const locale = parseLanguage(language);

  return typeof watched === 'boolean' && isDay(date) && locale
    ? { ...title, value: watched, date, language: locale }
    : null;
}

export function parseWatchedListRequest(
  value: unknown,
): WatchedListRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { page, language } = value as Record<string, unknown>;
  const locale = parseLanguage(language);

  return isPage(page) && locale ? { page, language: locale } : null;
}

/** A rating from 0.5 to 10 in steps of 0.5, or `null` to take it away. */
export function parseRateRequest(value: unknown): RateRequest | null {
  const title = parseTitleRequest(value);

  if (!title) {
    return null;
  }

  const { value: rating } = value as Record<string, unknown>;

  return rating === null ||
    (typeof rating === 'number' && RATINGS.includes(rating))
    ? { ...title, value: rating }
    : null;
}

export function parseAccountListRequest(
  value: unknown,
): AccountListRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { list, type, page, language } = value as Record<string, unknown>;
  const locale = parseLanguage(language);

  return isTitleList(list) && isMediaType(type) && isPage(page) && locale
    ? { list, type, page, language: locale }
    : null;
}

/** A v3 API key or a v4 access token, without surrounding spaces. */
export function parseApiKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const key = value.trim();

  return API_KEY.test(key) ? key : null;
}
