import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PAGES,
  PAGE_SIZE,
  currentPage,
  getImage,
  getMediaAttributesByType,
  getResult,
  loading,
  results,
  searchError,
  searchText,
  searched,
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
    theMovieDb.common.api_key = 'test-key';
    searchText.value = 'matrix';
    results.value = [];
    totalResults.value = 0;
    currentPage.value = 1;
    loading.value = false;
    searched.value = false;
    searchError.value = null;
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

  it('does not call the API for a query shorter than two characters', async () => {
    const getMovie = vi.spyOn(theMovieDb.search, 'getMovie');
    results.value = [{ id: 1 }];
    searchText.value = ' m ';

    await getResult(MEDIA_TYPES.MOVIE);

    expect(getMovie).not.toHaveBeenCalled();
    expect(results.value).toEqual([]);
    expect(searched.value).toBe(false);
  });

  it('trims and url-encodes the query', async () => {
    const getMovie = vi
      .spyOn(theMovieDb.search, 'getMovie')
      .mockResolvedValue(tmdbPage());
    searchText.value = '  tom & jerry ';

    await getResult(MEDIA_TYPES.MOVIE);

    expect(getMovie).toHaveBeenCalledWith({
      query: 'tom%20%26%20jerry',
      page: 1,
    });
  });

  it('ignores a slow response to an older request', async () => {
    let answerSlow: (value: unknown) => void = () => {};
    vi.spyOn(theMovieDb.search, 'getMovie')
      .mockReturnValueOnce(new Promise((resolve) => (answerSlow = resolve)))
      .mockResolvedValueOnce(
        tmdbPage({ results: [{ id: 2, title: 'The Matrix Reloaded' }] })
      );

    searchText.value = 'matri';
    const older = getResult(MEDIA_TYPES.MOVIE);
    searchText.value = 'matrix reloaded';
    await getResult(MEDIA_TYPES.MOVIE);

    answerSlow(tmdbPage({ results: [{ id: 1, title: 'Stale result' }] }));
    await older;

    expect(results.value).toEqual([{ id: 2, title: 'The Matrix Reloaded' }]);
    expect(loading.value).toBe(false);
  });

  it('flags loading only while the request is in flight', async () => {
    let answer: (value: unknown) => void = () => {};
    vi.spyOn(theMovieDb.search, 'getMovie').mockReturnValue(
      new Promise((resolve) => (answer = resolve))
    );

    const pending = getResult(MEDIA_TYPES.MOVIE);
    expect(loading.value).toBe(true);
    expect(searched.value).toBe(false);

    answer(tmdbPage());
    await pending;

    expect(loading.value).toBe(false);
    expect(searched.value).toBe(true);
  });

  it('exposes the failure and clears the results when the request fails', async () => {
    vi.spyOn(theMovieDb.search, 'getMovie').mockRejectedValue({
      status: 401,
      response: { status_message: 'Invalid API key' },
    });
    results.value = [{ id: 1 }];

    await getResult(MEDIA_TYPES.MOVIE);

    expect(searchError.value).toEqual({
      status: 401,
      message: 'Invalid API key',
    });
    expect(results.value).toEqual([]);
    expect(loading.value).toBe(false);
  });

  it('reports a missing API key without calling TMDB', async () => {
    const getMovie = vi.spyOn(theMovieDb.search, 'getMovie');
    theMovieDb.common.api_key = '';

    await getResult(MEDIA_TYPES.MOVIE);

    expect(getMovie).not.toHaveBeenCalled();
    expect(searchError.value).toEqual({ status: 401 });
    expect(loading.value).toBe(false);
  });

  it('clears a previous error when a new search starts', async () => {
    vi.spyOn(theMovieDb.search, 'getMovie').mockResolvedValue(tmdbPage());
    searchError.value = { status: 500 };

    await getResult(MEDIA_TYPES.MOVIE);

    expect(searchError.value).toBeNull();
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
  it('builds a TMDB url sized for the result cards', () => {
    expect(getImage('/poster.jpg')).toBe(
      'https://image.tmdb.org/t/p/w500/poster.jpg'
    );
  });

  it('accepts another image size', () => {
    expect(getImage('/poster.jpg', 'original')).toBe(
      'https://image.tmdb.org/t/p/original/poster.jpg'
    );
  });

  it('falls back to the default image when there is no path', () => {
    expect(getImage('')).toContain('default_search.jpg');
  });
});
