import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { MediaItem, Paged } from '@shared/api';
import { useDiscoverStore, type Discovery } from '@/stores/discover';
import { installFakeApi, MOVIE_FILTERS, TV_FILTERS } from '@/test/fakeApi';

const movie = (id: number): MediaItem => ({
  id,
  media_type: 'movie',
  title: `Movie ${id}`,
});

const pageOf = (
  ids: number[],
  page = 1,
  totalResults = 45,
): Paged<MediaItem> => ({
  page,
  results: ids.map(movie),
  totalPages: Math.ceil(totalResults / 20),
  totalResults,
});

const popular: Discovery = {
  type: 'movie',
  language: 'en',
  region: 'BR',
  sort: 'popularity',
};

/** A promise and the function that settles it, for an answer that waits. */
function later<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

describe('discover store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useDiscoverStore>;

  beforeEach(() => {
    api = installFakeApi();
    setActivePinia(createPinia());
    store = useDiscoverStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('asks for the first page of a discovery', async () => {
    api.tmdb.discover.mockResolvedValue({ ok: true, data: pageOf([1, 2]) });

    await store.discover(popular);

    expect(api.tmdb.discover).toHaveBeenCalledWith({ ...popular, page: 1 });
    expect(store.results.map((item) => item.id)).toEqual([1, 2]);
    expect(store.totalResults).toBe(45);
    expect(store.hasMore).toBe(true);
  });

  it('keeps the pages of the same discovery, as when coming back to it', async () => {
    api.tmdb.discover
      .mockResolvedValueOnce({ ok: true, data: pageOf([1, 2]) })
      .mockResolvedValueOnce({ ok: true, data: pageOf([3, 4], 2) });

    await store.discover(popular);
    await store.loadMore();
    await store.discover({ ...popular });

    expect(api.tmdb.discover).toHaveBeenCalledTimes(2);
    expect(store.results.map((item) => item.id)).toEqual([1, 2, 3, 4]);
  });

  it('adds the next page at the end, each title once', async () => {
    api.tmdb.discover
      .mockResolvedValueOnce({ ok: true, data: pageOf([1, 2]) })
      .mockResolvedValueOnce({ ok: true, data: pageOf([2, 3], 2) });

    await store.discover(popular);
    await store.loadMore();

    expect(api.tmdb.discover).toHaveBeenLastCalledWith({
      ...popular,
      page: 2,
    });
    expect(store.results.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(store.currentPage).toBe(2);
  });

  it('starts again with other filters, keeping the titles shown meanwhile', async () => {
    const waiting = later<{ ok: true; data: Paged<MediaItem> }>();

    api.tmdb.discover
      .mockResolvedValueOnce({ ok: true, data: pageOf([1, 2]) })
      .mockReturnValueOnce(waiting.promise);

    await store.discover(popular);
    const next = store.discover({ ...popular, genres: [18] });

    expect(store.loading).toBe(true);
    expect(store.results.map((item) => item.id)).toEqual([1, 2]);

    waiting.resolve({ ok: true, data: pageOf([7], 1, 1) });
    await next;

    expect(store.results.map((item) => item.id)).toEqual([7]);
    expect(store.hasMore).toBe(false);
  });

  it('drops the answer of a discovery that other filters replaced', async () => {
    const slow = later<{ ok: true; data: Paged<MediaItem> }>();

    api.tmdb.discover
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce({ ok: true, data: pageOf([9]) });

    const first = store.discover(popular);
    await store.discover({ ...popular, sort: 'rating' });
    slow.resolve({ ok: true, data: pageOf([1]) });
    await first;

    expect(store.results.map((item) => item.id)).toEqual([9]);
  });

  it('says why a discovery failed, and asks again when told to', async () => {
    api.tmdb.discover
      .mockResolvedValueOnce({ ok: false, error: { code: 'network' } })
      .mockResolvedValueOnce({ ok: true, data: pageOf([1]) });

    await store.discover(popular);

    expect(store.error).toEqual({ code: 'network' });
    expect(store.results).toEqual([]);

    store.retry();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.tmdb.discover).toHaveBeenCalledTimes(2);
    expect(store.error).toBeNull();
  });

  it('asks again for a discovery that failed when it comes back', async () => {
    api.tmdb.discover
      .mockRejectedValueOnce(new Error('gone'))
      .mockResolvedValueOnce({ ok: true, data: pageOf([1]) });

    await store.discover(popular);
    expect(store.error).toMatchObject({ code: 'server', message: 'gone' });

    await store.discover(popular);

    expect(store.results.map((item) => item.id)).toEqual([1]);
  });

  it('keeps the titles when the next page fails, to try it again', async () => {
    api.tmdb.discover
      .mockResolvedValueOnce({ ok: true, data: pageOf([1, 2]) })
      .mockResolvedValueOnce({ ok: false, error: { code: 'timeout' } });

    await store.discover(popular);
    await store.loadMore();

    expect(store.moreFailed).toBe(true);
    expect(store.results).toHaveLength(2);
    expect(store.currentPage).toBe(1);
  });

  describe('what the filters offer', () => {
    const movies = { type: 'movie', language: 'en', region: 'BR' } as const;
    const shows = { ...movies, type: 'tv' } as const;

    it('loads them once for each type, language and country', async () => {
      await Promise.all([store.loadFilters(movies), store.loadFilters(movies)]);
      await store.loadFilters(movies);
      await store.loadFilters(shows);

      expect(api.tmdb.discoverFilters).toHaveBeenCalledTimes(2);
      expect(store.filtersOf(movies)).toEqual(MOVIE_FILTERS);
      expect(store.filtersOf(shows)).toEqual(TV_FILTERS);
      expect(store.filtersOf({ ...movies, language: 'es' })).toBeNull();
    });

    it('says when they could not be loaded, and tries again', async () => {
      api.tmdb.discoverFilters.mockResolvedValueOnce({
        ok: false,
        error: { code: 'network' },
      });

      await store.loadFilters(movies);
      expect(store.filtersFailedFor(movies)).toBe(true);

      await store.loadFilters(movies);
      expect(store.filtersFailedFor(movies)).toBe(false);
      expect(store.filtersOf(movies)).toEqual(MOVIE_FILTERS);
    });
  });
});
