import { describe, expect, it } from 'vitest';
import {
  filtersInUse,
  readChoice,
  toQuery,
  withoutFilters,
  type DiscoverChoice,
} from './query';

const START: DiscoverChoice = {
  type: 'movie',
  sort: 'popularity',
  genres: [],
  fromYear: undefined,
  toYear: undefined,
  minRating: undefined,
  originalLanguage: undefined,
  ageRating: undefined,
  mine: false,
};

describe('the choice of the Explore page in its address', () => {
  it('starts with the popular movies', () => {
    expect(readChoice({})).toEqual(START);
    expect(toQuery(START)).toEqual({});
  });

  it('reads every filter, and writes them back the same', () => {
    const query = {
      type: 'tv',
      sort: 'rating',
      genres: '18,80',
      from: '1990',
      to: '1999',
      rating: '7',
      original: 'ko',
      age: 'M/12',
      mine: '1',
    };

    const choice = readChoice(query);

    expect(choice).toEqual({
      type: 'tv',
      sort: 'rating',
      genres: [18, 80],
      fromYear: 1990,
      toYear: 1999,
      minRating: 7,
      originalLanguage: 'ko',
      ageRating: 'M/12',
      mine: true,
    });
    expect(toQuery(choice)).toEqual(query);
  });

  it('puts years the wrong way round in order', () => {
    expect(readChoice({ from: '1999', to: '1990' })).toMatchObject({
      fromYear: 1990,
      toYear: 1999,
    });
  });

  it.each([
    ['an unknown type', { type: 'person' }],
    ['an unknown order', { sort: 'revenue' }],
    ['genres that are not ids', { genres: 'drama,,-1' }],
    ['a year before the movies', { from: '1500' }],
    ['a year that is not one', { to: '199x' }],
    ['a rating of 10', { rating: '10' }],
    ['a language that is not a code', { original: 'kor' }],
    ['an age rating that joins two', { age: 'L|10' }],
    ['a switch that is not on', { mine: 'yes' }],
    ['the same field twice', { type: ['tv', 'tv'] }],
  ])('leaves out %s', (_case, query) => {
    expect(readChoice(query)).toEqual(START);
  });

  it('keeps each genre once, ten at most', () => {
    const genres = Array.from({ length: 12 }, (_, index) => index + 1);

    expect(
      readChoice({ genres: `18,18,${genres.join(',')}` }).genres,
    ).toHaveLength(10);
    expect(readChoice({ genres: '18,18,80' }).genres).toEqual([18, 80]);
  });

  it('counts the filters in use, the type and the order apart', () => {
    const choice = readChoice({
      type: 'tv',
      sort: 'newest',
      genres: '18,80',
      from: '1990',
      to: '1999',
      age: '14',
      mine: '1',
    });

    expect(filtersInUse(choice, true)).toBe(4);
    // the switch without services to show
    expect(filtersInUse(choice, false)).toBe(3);
    expect(filtersInUse(START, false)).toBe(0);
  });

  it('clears every filter, keeping the type and the order', () => {
    const choice = readChoice({ type: 'tv', sort: 'rating', genres: '18' });

    expect(toQuery(withoutFilters(choice))).toEqual({
      type: 'tv',
      sort: 'rating',
    });
  });
});
