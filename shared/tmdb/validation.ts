import type {
  DetailsRequest,
  ListRequest,
  MediaList,
  SearchRequest,
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

export function parseSearchRequest(value: unknown): SearchRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { type, query, page, language } = value as Record<string, unknown>;
  const text = typeof query === 'string' ? query.trim() : '';
  const locale = parseLanguage(language);

  if (
    (type !== 'movie' && type !== 'tv') ||
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

  return { type, query: text, page, language: locale };
}

/** A v3 API key or a v4 access token, without surrounding spaces. */
export function parseApiKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const key = value.trim();

  return API_KEY.test(key) ? key : null;
}
