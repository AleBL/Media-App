import { describe, expect, it } from 'vitest';
import {
  getImage,
  getMediaAttributesByType,
} from '@/services/searchMediaLogic';
import { MEDIA_TYPES } from '@/util/constants';

describe('getMediaAttributesByType', () => {
  it('returns movie attributes', () => {
    expect(getMediaAttributesByType(MEDIA_TYPES.MOVIE)).toEqual({
      propertyName: 'title',
      searchFunction: 'getMovie',
      releaseDate: 'release_date',
    });
  });

  it('returns tv show attributes', () => {
    expect(getMediaAttributesByType(MEDIA_TYPES.TV_SHOW)).toEqual({
      propertyName: 'name',
      searchFunction: 'getTv',
      releaseDate: 'first_air_date',
    });
  });

  it('throws on an unknown media type', () => {
    expect(() => getMediaAttributesByType(99)).toThrow(/99/);
  });
});

describe('getImage', () => {
  it('builds the TMDB image url from a poster path', () => {
    expect(getImage('/poster.jpg')).toBe(
      'https://image.tmdb.org/t/p/original/poster.jpg'
    );
  });

  it('falls back to the default image when there is no path', () => {
    expect(getImage('')).toContain('default_search.jpg');
  });
});
