// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  parseAccountListRequest,
  parseApiKey,
  parseDetailsRequest,
  parseDiscoverFiltersRequest,
  parseDiscoverRequest,
  parseLanguage,
  parseListRequest,
  parseMarkRequest,
  parsePersonRequest,
  parseProgressRequest,
  parseRateRequest,
  parseRegion,
  parseSearchRequest,
  parseSeasonRequest,
  parseTitleRequest,
  parseWatchedListRequest,
  parseWatchedRequest,
} from './validation';

describe('requests about the watched titles', () => {
  const mark = {
    type: 'movie',
    id: 603,
    value: true,
    date: '2026-11-16',
    language: 'pt-BR',
  };

  it('accepts them and drops fields they do not know', () => {
    expect(parseWatchedRequest({ ...mark, listId: 7 })).toEqual(mark);
    expect(parseWatchedRequest({ ...mark, value: false })).toEqual({
      ...mark,
      value: false,
    });
    expect(parseWatchedListRequest({ page: 3, language: 'es', x: 1 })).toEqual({
      page: 3,
      language: 'es',
    });
  });

  it.each([
    ['a value that is not true or false', { ...mark, value: 'true' }],
    ['a day in another shape', { ...mark, date: '16/11/2026' }],
    ['a day that does not exist', { ...mark, date: '2026-02-30' }],
    ['no day', { ...mark, date: undefined }],
    ['a language that is not a locale', { ...mark, language: '../x' }],
    ['a person', { ...mark, type: 'person' }],
  ])('refuses a mark with %s', (_case, request) => {
    expect(parseWatchedRequest(request)).toBeNull();
  });

  it.each([
    ['page zero', { page: 0, language: 'en' }],
    ['a page past the last one', { page: 501, language: 'en' }],
    ['no language', { page: 1 }],
    ['nothing', null],
  ])('refuses a page with %s', (_case, request) => {
    expect(parseWatchedListRequest(request)).toBeNull();
  });
});

describe('requests about the episodes watched', () => {
  const save = {
    id: 1396,
    seasons: { 1: [1, 2, 3], 0: [2] },
    date: '2026-11-20',
    language: 'pt-BR',
  };

  it('accepts them, each episode once and in order', () => {
    expect(parseProgressRequest({ ...save, value: true })).toEqual(save);
    expect(
      parseProgressRequest({ ...save, seasons: { 2: [3, 1, 3], 4: [] } }),
    ).toEqual({ ...save, seasons: { 2: [1, 3] } });
  });

  it('accepts no episode at all, which takes the show out', () => {
    expect(parseProgressRequest({ ...save, seasons: {} })).toEqual({
      ...save,
      seasons: {},
    });
  });

  it.each([
    ['a season that is not a number', { x: [1] }],
    ['a season past any show', { 1001: [1] }],
    ['an episode 0', { 1: [0] }],
    ['an episode that is not a number', { 1: ['1'] }],
    ['an episode past any season', { 1: [10_001] }],
    ['episodes that are not a list', { 1: 1 }],
    ['seasons that are a list', [[1]]],
    ['no seasons', undefined],
    [
      'more than the comment can hold',
      Object.fromEntries(
        Array.from({ length: 900 }, (_, season) => [season + 1, [1, 3]]),
      ),
    ],
  ])('refuses %s', (_case, seasons) => {
    expect(parseProgressRequest({ ...save, seasons })).toBeNull();
  });

  it.each([
    ['a show without an id', { ...save, id: 0 }],
    ['a day that does not exist', { ...save, date: '2026-02-30' }],
    ['a language that is not a locale', { ...save, language: '../x' }],
    ['nothing', null],
  ])('refuses a request with %s', (_case, request) => {
    expect(parseProgressRequest(request)).toBeNull();
  });
});

describe('requests about the lists of the account', () => {
  const title = { type: 'movie', id: 603 };
  const mark = { ...title, list: 'favorite', value: false };
  const page = { list: 'watchlist', type: 'tv', page: 1, language: 'pt-BR' };

  it('accepts them and drops fields they do not know', () => {
    expect(parseTitleRequest({ ...title, sessionId: 'x' })).toEqual(title);
    expect(parseMarkRequest({ ...mark, accountId: 1 })).toEqual(mark);
    expect(parseAccountListRequest({ ...page, sort: 'x' })).toEqual(page);
    expect(parseAccountListRequest({ ...page, list: 'rated' })).toEqual({
      ...page,
      list: 'rated',
    });
  });

  it.each([
    ['nothing', undefined],
    ['a person', { ...title, type: 'person' }],
    ['an id that is not one', { ...title, id: '603/account_states' }],
    ['id zero', { ...title, id: 0 }],
  ])('refuses a title of %s', (_case, request) => {
    expect(parseTitleRequest(request)).toBeNull();
    expect(
      parseMarkRequest(
        request && { ...request, list: 'favorite', value: true },
      ),
    ).toBeNull();
  });

  it.each([
    ['the rated titles, which a rating changes', { ...mark, list: 'rated' }],
    ['a value that is not true or false', { ...mark, value: 'true' }],
    ['no value', { ...title, list: 'watchlist' }],
  ])('refuses a change with %s', (_case, request) => {
    expect(parseMarkRequest(request)).toBeNull();
  });

  it.each([
    ['a list the app does not use', { ...page, list: 'lists' }],
    ['a type of everything', { ...page, type: 'multi' }],
    ['page zero', { ...page, page: 0 }],
    ['a page past the last one', { ...page, page: 501 }],
    ['a language that is not a locale', { ...page, language: '../x' }],
  ])('refuses a page of a list with %s', (_case, request) => {
    expect(parseAccountListRequest(request)).toBeNull();
  });
});

describe('requests about the ratings of the account', () => {
  const title = { type: 'tv', id: 1396 };

  it.each([0.5, 1, 7.5, 10])('accepts a rating of %s', (value) => {
    expect(parseRateRequest({ ...title, value, sessionId: 'x' })).toEqual({
      ...title,
      value,
    });
  });

  it('accepts taking the rating away', () => {
    expect(parseRateRequest({ ...title, value: null })).toEqual({
      ...title,
      value: null,
    });
  });

  it.each([
    ['zero', 0],
    ['below zero', -1],
    ['above 10', 10.5],
    ['between two steps', 7.25],
    ['that is not a number', '8'],
    ['that is not a number at all', Number.NaN],
    ['missing', undefined],
  ])('refuses a rating %s', (_case, value) => {
    expect(parseRateRequest({ ...title, value })).toBeNull();
  });

  it('refuses a rating of something that is not a title', () => {
    expect(parseRateRequest({ type: 'person', id: 1, value: 8 })).toBeNull();
    expect(parseRateRequest(null)).toBeNull();
  });
});

describe('parseLanguage', () => {
  it.each(['en', 'es', 'pt-BR'])('accepts %s', (language) => {
    expect(parseLanguage(language)).toBe(language);
  });

  it.each(['', 'english', 'pt_BR', 'EN', '../../etc', 5, null, undefined])(
    'rejects %s',
    (language) => {
      expect(parseLanguage(language)).toBeNull();
    },
  );
});

describe('parseSearchRequest', () => {
  const valid = { type: 'movie', query: 'matrix', page: 1, language: 'en' };

  it('accepts a search and trims the query', () => {
    expect(parseSearchRequest({ ...valid, query: '  tom & jerry ' })).toEqual({
      ...valid,
      query: 'tom & jerry',
    });
  });

  it('drops fields it does not know', () => {
    expect(parseSearchRequest({ ...valid, apiKey: 'x', extra: true })).toEqual(
      valid,
    );
  });

  it.each(['tv', 'multi'])('accepts a search of type %s', (type) => {
    expect(parseSearchRequest({ ...valid, type })).toEqual({ ...valid, type });
  });

  it('accepts the year of a movie or a tv show, and no year for everything', () => {
    expect(parseSearchRequest({ ...valid, year: 1999 })).toEqual({
      ...valid,
      year: 1999,
    });
    expect(parseSearchRequest({ ...valid, type: 'multi', year: 1999 })).toEqual(
      { ...valid, type: 'multi' },
    );
  });

  it.each([
    ['a missing request', undefined],
    ['a string', 'matrix'],
    ['an unknown media type', { ...valid, type: 'person' }],
    ['an empty query', { ...valid, query: '   ' }],
    ['a query that is not text', { ...valid, query: ['matrix'] }],
    ['a huge query', { ...valid, query: 'x'.repeat(201) }],
    ['page zero', { ...valid, page: 0 }],
    ['a page past the last one', { ...valid, page: 501 }],
    ['a fractional page', { ...valid, page: 1.5 }],
    ['a page sent as text', { ...valid, page: '1' }],
    ['a language that is not a locale', { ...valid, language: '../x' }],
    ['a year sent as text', { ...valid, year: '1999' }],
    ['a year before the movies', { ...valid, year: 1800 }],
    ['a fractional year', { ...valid, year: 1999.5 }],
  ])('rejects %s', (_case, request) => {
    expect(parseSearchRequest(request)).toBeNull();
  });
});

describe('parseDiscoverRequest', () => {
  const valid = {
    type: 'tv',
    page: 1,
    language: 'pt-BR',
    region: 'BR',
    sort: 'popularity',
  };
  const everything = {
    ...valid,
    sort: 'rating',
    genres: [18, 80],
    fromYear: 1990,
    toYear: 1999,
    minRating: 7,
    originalLanguage: 'ko',
    ageRating: 'M/12',
    providers: [8, 119],
  };

  it('accepts a discovery with no filter and drops fields it does not know', () => {
    expect(parseDiscoverRequest({ ...valid, path: '/account' })).toEqual(valid);
  });

  it('accepts every filter, each genre and service once', () => {
    expect(
      parseDiscoverRequest({ ...everything, genres: [18, 80, 18] }),
    ).toEqual(everything);
  });

  it('accepts a single year, an age rating with accents and no list', () => {
    expect(
      parseDiscoverRequest({
        ...valid,
        fromYear: 2005,
        toYear: 2005,
        ageRating: 'Públicos',
        genres: [],
        providers: [],
      }),
    ).toEqual({
      ...valid,
      fromYear: 2005,
      toYear: 2005,
      ageRating: 'Públicos',
    });
  });

  it.each([
    ['a missing request', undefined],
    ['an unknown media type', { ...valid, type: 'multi' }],
    ['a page past the last one', { ...valid, page: 501 }],
    ['an unknown order', { ...valid, sort: 'revenue' }],
    ['an order of the prototype', { ...valid, sort: 'constructor' }],
    ['no region', { ...valid, region: undefined }],
    ['a language that is not a locale', { ...valid, language: 'pt_BR' }],
    ['genres that are not ids', { ...valid, genres: ['18'] }],
    [
      'too many genres',
      { ...valid, genres: Array.from({ length: 11 }, (_, i) => i + 1) },
    ],
    ['services that are not a list', { ...valid, providers: 8 }],
    ['years the wrong way round', { ...valid, fromYear: 2000, toYear: 1990 }],
    ['a year sent as text', { ...valid, fromYear: '1990' }],
    ['a rating of 10', { ...valid, minRating: 10 }],
    ['a fractional rating', { ...valid, minRating: 7.5 }],
    ['a language that is not a code', { ...valid, originalLanguage: 'kor' }],
    ['an age rating that joins two', { ...valid, ageRating: 'L|10' }],
    ['an age rating too long', { ...valid, ageRating: 'x'.repeat(13) }],
  ])('rejects %s', (_case, request) => {
    expect(parseDiscoverRequest(request)).toBeNull();
  });
});

describe('parseDiscoverFiltersRequest', () => {
  const valid = { type: 'movie', language: 'en', region: 'US' };

  it('accepts the filters of a type in a country', () => {
    expect(parseDiscoverFiltersRequest({ ...valid, extra: 1 })).toEqual(valid);
  });

  it.each([
    ['a missing request', undefined],
    ['an unknown media type', { ...valid, type: 'person' }],
    ['no language', { ...valid, language: undefined }],
    ['a region that is not a country', { ...valid, region: 'USA' }],
  ])('rejects %s', (_case, request) => {
    expect(parseDiscoverFiltersRequest(request)).toBeNull();
  });
});

describe('parseRegion', () => {
  it.each(['BR', 'US', 'GB'])('accepts %s', (region) => {
    expect(parseRegion(region)).toBe(region);
  });

  it.each(['', 'br', 'BRA', '419', 'pt-BR', '__proto__', 5, null])(
    'rejects %s',
    (region) => {
      expect(parseRegion(region)).toBeNull();
    },
  );
});

describe('parseListRequest', () => {
  it.each([
    'trending',
    'trending-movies',
    'trending-tv',
    'popular-movies',
    'popular-tv',
    'now-playing',
  ])('accepts the list %s', (list) => {
    expect(parseListRequest({ list, language: 'es', extra: 1 })).toEqual({
      list,
      language: 'es',
    });
  });

  it.each([
    ['a missing request', undefined],
    ['a list the app does not show', { list: 'top_rated', language: 'en' }],
    ['a path', { list: '/trending/all/week', language: 'en' }],
    ['a name of the prototype', { list: 'constructor', language: 'en' }],
    ['a language that is not a locale', { list: 'trending', language: 'x' }],
    [
      'a region that is not a country',
      { list: 'now-playing', language: 'en', region: 'Brazil' },
    ],
  ])('rejects %s', (_case, request) => {
    expect(parseListRequest(request)).toBeNull();
  });

  it('keeps the country of the theaters', () => {
    expect(
      parseListRequest({ list: 'now-playing', language: 'en', region: 'BR' }),
    ).toEqual({ list: 'now-playing', language: 'en', region: 'BR' });
  });
});

describe('parseDetailsRequest', () => {
  const valid = { type: 'tv', id: 1396, language: 'pt-BR', region: 'BR' };

  it('accepts the page of a title and drops fields it does not know', () => {
    expect(parseDetailsRequest({ ...valid, path: '/account' })).toEqual(valid);
  });

  it.each([
    ['a missing request', undefined],
    ['an unknown media type', { ...valid, type: 'person' }],
    ['an id sent as text', { ...valid, id: '1396' }],
    ['id zero', { ...valid, id: 0 }],
    ['a fractional id', { ...valid, id: 1.5 }],
    ['an id that is not finite', { ...valid, id: Infinity }],
    ['a huge id', { ...valid, id: 2 ** 40 }],
    ['a language that is not a locale', { ...valid, language: 'x' }],
    ['no region', { ...valid, region: undefined }],
    ['a region that is not a country', { ...valid, region: 'Brazil' }],
  ])('rejects %s', (_case, request) => {
    expect(parseDetailsRequest(request)).toBeNull();
  });
});

describe('parseSeasonRequest', () => {
  const valid = { id: 1396, season: 2, language: 'pt-BR' };

  it('accepts a season, the specials too, and drops fields it does not know', () => {
    expect(parseSeasonRequest({ ...valid, path: '/account' })).toEqual(valid);
    expect(parseSeasonRequest({ ...valid, season: 0 })).toEqual({
      ...valid,
      season: 0,
    });
  });

  it.each([
    ['a missing request', undefined],
    ['an id that is no id', { ...valid, id: 0 }],
    ['a season sent as text', { ...valid, season: '2' }],
    ['a negative season', { ...valid, season: -1 }],
    ['a fractional season', { ...valid, season: 1.5 }],
    ['a season past any show', { ...valid, season: 1001 }],
    ['a language that is not a locale', { ...valid, language: 'pt_BR' }],
  ])('rejects %s', (_case, request) => {
    expect(parseSeasonRequest(request)).toBeNull();
  });
});

describe('parsePersonRequest', () => {
  const valid = { id: 6384, language: 'pt-BR' };

  it('accepts the page of a person and drops fields it does not know', () => {
    expect(parsePersonRequest({ ...valid, path: '/account' })).toEqual(valid);
  });

  it.each([
    ['a missing request', undefined],
    ['an id sent as text', { ...valid, id: '6384' }],
    ['id zero', { ...valid, id: 0 }],
    ['a huge id', { ...valid, id: 2 ** 40 }],
    ['a language that is not a locale', { ...valid, language: 'pt_BR' }],
  ])('rejects %s', (_case, request) => {
    expect(parsePersonRequest(request)).toBeNull();
  });
});

describe('parseApiKey', () => {
  it('accepts a v3 key and a v4 token, without the spaces around them', () => {
    expect(parseApiKey(' 0123456789abcdef0123456789abcdef \n')).toBe(
      '0123456789abcdef0123456789abcdef',
    );
    expect(parseApiKey('eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJ4In0.c2ln-YXR_')).toBe(
      'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJ4In0.c2ln-YXR_',
    );
  });

  it.each(['', 'short', 'has spaces inside the key', 'x'.repeat(1025), 42])(
    'rejects %s',
    (key) => {
      expect(parseApiKey(key)).toBeNull();
    },
  );
});
