// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  parseApiKey,
  parseDetailsRequest,
  parseLanguage,
  parseListRequest,
  parseRegion,
  parseSearchRequest,
} from './validation';

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
  ])('rejects %s', (_case, request) => {
    expect(parseSearchRequest(request)).toBeNull();
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
  it.each(['trending', 'popular-movies', 'popular-tv'])(
    'accepts the list %s',
    (list) => {
      expect(parseListRequest({ list, language: 'es', extra: 1 })).toEqual({
        list,
        language: 'es',
      });
    },
  );

  it.each([
    ['a missing request', undefined],
    ['a list the app does not show', { list: 'top_rated', language: 'en' }],
    ['a path', { list: '/trending/all/week', language: 'en' }],
    ['a name of the prototype', { list: 'constructor', language: 'en' }],
    ['a language that is not a locale', { list: 'trending', language: 'x' }],
  ])('rejects %s', (_case, request) => {
    expect(parseListRequest(request)).toBeNull();
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
