import type { SearchRequest } from '../../../shared/api';
import { TMDB_MAX_PAGES } from './client';

// Everything that arrives from the renderer over IPC is checked here before
// it is used: the main process does not trust the renderer's types.

const LANGUAGE = /^[a-z]{2}(-[A-Z]{2})?$/;
const API_KEY = /^[\w.-]{16,1024}$/;
const MAX_QUERY_LENGTH = 200;

/** An app locale such as `en` or `pt-BR`. */
export function parseLanguage(value: unknown): string | null {
  return typeof value === 'string' && LANGUAGE.test(value) ? value : null;
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
