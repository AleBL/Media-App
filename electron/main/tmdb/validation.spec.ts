// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseApiKey, parseLanguage, parseSearchRequest } from './validation';

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
