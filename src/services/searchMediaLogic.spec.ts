import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PAGES,
  PAGE_SIZE,
  currentPage,
  getImage,
  getMediaAttributesByType,
  getResult,
  results,
  searchText,
  totalResults,
} from '@/services/searchMediaLogic';
import { MEDIA_TYPES } from '@/util/constants';
import { theMovieDb } from '@/util/tmdb';

function tmdbPage(overrides = {}) {
  return {
    response: {
      page: 1,
      results: [{ id: 1, title: 'The Matrix' }],
      total_pages: 3,
      total_results: 45,
      ...overrides,
    },
  };
}

describe('getResult', () => {
  beforeEach(() => {
    searchText.value = 'matrix';
    results.value = [];
    totalResults.value = 0;
    currentPage.value = 1;
  });

  it('stores the total number of results, not the number of pages', async () => {
    vi.spyOn(theMovieDb.search, 'getMovie').mockResolvedValue(tmdbPage());

    await getResult(MEDIA_TYPES.MOVIE);

    expect(totalResults.value).toBe(45);
    expect(Math.ceil(totalResults.value / PAGE_SIZE)).toBe(3);
    expect(results.value).toHaveLength(1);
  });

  it('keeps the page returned by the API', async () => {
    const getTv = vi
      .spyOn(theMovieDb.search, 'getTv')
      .mockResolvedValue(tmdbPage({ page: 2 }));

    await getResult(MEDIA_TYPES.TV_SHOW, 2);

    expect(getTv).toHaveBeenCalledWith({ query: 'matrix', page: 2 });
    expect(currentPage.value).toBe(2);
  });

  it('caps the total at the last page TMDB accepts', async () => {
    vi.spyOn(theMovieDb.search, 'getMovie').mockResolvedValue(
      tmdbPage({ total_pages: 900, total_results: 18000 })
    );

    await getResult(MEDIA_TYPES.MOVIE);

    expect(totalResults.value).toBe(MAX_PAGES * PAGE_SIZE);
  });
});

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
