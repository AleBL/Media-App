import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/plugins/i18n';
import { rowDetails, rowTitle } from './rowText';

const GENRES: Record<number, string> = { 18: 'Drama', 80: 'Crime' };
const names = (ids: number[]) => ids.map((id) => GENRES[id]).join(', ');

describe('the text of a row of the home page', () => {
  const t = i18n.global.t as (
    key: string,
    values?: Record<string, unknown>,
  ) => string;

  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });

  it('names a list of TMDB', () => {
    expect(rowTitle({ list: 'now-playing' }, t, names)).toBe(
      'Now playing in theaters',
    );
    expect(rowDetails({ list: 'now-playing' }, t, 'en')).toBe('');
  });

  it('names a choice by its type, its order and its genres', () => {
    expect(rowTitle({ query: {} }, t, names)).toBe('Popular movies');
    expect(
      rowTitle(
        { query: { type: 'tv', sort: 'rating', genres: '18,80' } },
        t,
        names,
      ),
    ).toBe('Best rated TV shows: Drama, Crime');
    // before the names of the genres come
    expect(rowTitle({ query: { genres: '18' } }, t, () => '')).toBe(
      'Popular movies',
    );
  });

  it('says the other filters under the title', () => {
    expect(
      rowDetails(
        {
          query: {
            from: '1990',
            to: '1999',
            rating: '7',
            age: '14',
            original: 'ko',
            mine: '1',
          },
        },
        t,
        'en',
      ),
    ).toBe('1990s · Rating 7+ · Rated up to 14 · Korean · On my services');
    expect(rowDetails({ query: { from: '2005', to: '2005' } }, t, 'en')).toBe(
      '2005',
    );
    expect(rowDetails({ query: { from: '1995', to: '2004' } }, t, 'en')).toBe(
      '1995 to 2004',
    );
    expect(rowDetails({ query: { from: '2015' } }, t, 'en')).toBe('Since 2015');
    expect(rowDetails({ query: { to: '1980' } }, t, 'en')).toBe('Until 1980');
  });

  it('speaks the language of the app', () => {
    i18n.global.locale.value = 'pt-BR';

    expect(rowTitle({ query: { type: 'tv', sort: 'rating' } }, t, names)).toBe(
      'Séries mais bem avaliadas',
    );
    expect(
      rowDetails({ query: { original: 'ko', mine: '1' } }, t, 'pt-BR'),
    ).toBe('Coreano · Nos meus serviços');
  });
});
