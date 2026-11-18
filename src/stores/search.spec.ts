import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { MediaItem, Paged, Result, SearchItem } from '@shared/api';
import i18n from '@/plugins/i18n';
import { useSearchStore } from '@/stores/search';
import { installFakeApi, pageOf } from '@/test/fakeApi';

const MATRIX: MediaItem = { id: 603, title: 'The Matrix' };

function found(
  results: SearchItem[] = [MATRIX],
  overrides: Partial<Paged<SearchItem>> = {},
): Result<Paged<SearchItem>> {
  return { ok: true, data: pageOf(results, overrides) };
}

describe('search store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useSearchStore>;

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    setActivePinia(createPinia());
    store = useSearchStore();
    store.query = 'matrix';
  });

  afterEach(() => {
    delete window.api;
  });

  it('asks the main process with the query, type, page and language', async () => {
    i18n.global.locale.value = 'pt-BR';
    store.mediaType = 'tv';

    await store.search(2);

    expect(api.tmdb.search).toHaveBeenCalledWith({
      type: 'tv',
      query: 'matrix',
      page: 2,
      language: 'pt-BR',
    });
  });

  it('keeps the page, the results and the total sent back', async () => {
    api.tmdb.search.mockResolvedValue(
      found([MATRIX], { page: 2, totalPages: 3, totalResults: 45 }),
    );

    await store.search(2);

    expect(store.results).toEqual([MATRIX]);
    expect(store.currentPage).toBe(2);
    expect(store.totalResults).toBe(45);
    expect(store.searched).toBe(true);
  });

  it('trims the query and leaves special characters alone', async () => {
    store.query = '  tom & jerry ';

    await store.search();

    expect(api.tmdb.search).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'tom & jerry' }),
    );
  });

  it('does not search for a query shorter than two characters', async () => {
    store.results = [MATRIX];
    store.query = ' m ';

    await store.search();

    expect(api.tmdb.search).not.toHaveBeenCalled();
    expect(store.results).toEqual([]);
    expect(store.searched).toBe(false);
  });

  it('ignores a slow answer to an older request', async () => {
    let answerSlow: (value: Result<Paged<SearchItem>>) => void = () => {};
    api.tmdb.search
      .mockReturnValueOnce(new Promise((resolve) => (answerSlow = resolve)))
      .mockResolvedValueOnce(found([{ id: 604, title: 'Reloaded' }]));

    store.query = 'matri';
    const older = store.search();
    store.query = 'matrix reloaded';
    await store.search();

    answerSlow(found([{ id: 1, title: 'Stale result' }]));
    await older;

    expect(store.results).toEqual([{ id: 604, title: 'Reloaded' }]);
    expect(store.loading).toBe(false);
  });

  it('knows what the results were searched as while another type loads', async () => {
    const person: SearchItem = {
      id: 6384,
      media_type: 'person',
      name: 'Keanu Reeves',
      known_for: [],
    };
    let answer: (value: Result<Paged<SearchItem>>) => void = () => {};

    store.mediaType = 'multi';
    api.tmdb.search.mockResolvedValueOnce(found([person, MATRIX]));
    await store.search();

    expect(api.tmdb.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'multi' }),
    );
    expect(store.results).toEqual([person, MATRIX]);
    expect(store.resultsType).toBe('multi');

    api.tmdb.search.mockReturnValueOnce(
      new Promise((resolve) => (answer = resolve)),
    );
    store.mediaType = 'tv';
    const pending = store.search();

    expect(store.resultsType).toBe('multi');

    answer(found([{ id: 1396, name: 'Breaking Bad' }]));
    await pending;

    expect(store.resultsType).toBe('tv');
  });

  it('flags loading only while the request is in flight', async () => {
    let answer: (value: Result<Paged<SearchItem>>) => void = () => {};
    api.tmdb.search.mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );

    const pending = store.search();
    expect(store.loading).toBe(true);
    expect(store.searched).toBe(false);

    answer(found());
    await pending;

    expect(store.loading).toBe(false);
    expect(store.searched).toBe(true);
  });

  it('exposes a failure and clears the results', async () => {
    api.tmdb.search.mockResolvedValue({
      ok: false,
      error: { code: 'unauthorized', status: 401, message: 'Invalid API key' },
    });
    store.results = [MATRIX];

    await store.search();

    expect(store.error).toEqual({
      code: 'unauthorized',
      status: 401,
      message: 'Invalid API key',
    });
    expect(store.results).toEqual([]);
    expect(store.loading).toBe(false);
  });

  it('treats a broken bridge to the main process as a failure', async () => {
    api.tmdb.search.mockRejectedValue(new Error('No handler registered'));

    await store.search();

    expect(store.error).toEqual({
      code: 'server',
      message: 'No handler registered',
    });
    expect(store.loading).toBe(false);
  });

  it('clears a previous error when a new search starts', async () => {
    store.error = { code: 'network' };

    await store.search();

    expect(store.error).toBeNull();
  });

  describe('more results at the end', () => {
    const movie = (id: number): MediaItem => ({ id, title: `Movie ${id}` });
    const page = (ids: number[], number: number) =>
      found(ids.map(movie), { page: number, totalResults: 45 });

    beforeEach(async () => {
      api.tmdb.search.mockResolvedValueOnce(page([1, 2], 1));
      await store.search();
    });

    it('adds the next page after the ones shown', async () => {
      api.tmdb.search.mockResolvedValueOnce(page([3, 4], 2));

      await store.loadMore();

      expect(api.tmdb.search).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: 'matrix', page: 2 }),
      );
      expect(store.results.map((item) => item.id)).toEqual([1, 2, 3, 4]);
      expect(store.currentPage).toBe(2);
      expect(store.hasMore).toBe(true);
    });

    it('shows a title that moved to the next page once', async () => {
      api.tmdb.search.mockResolvedValueOnce(page([2, 3], 2));

      await store.loadMore();

      expect(store.results.map((item) => item.id)).toEqual([1, 2, 3]);
    });

    it('stops at the last page', async () => {
      store.currentPage = 3;

      await store.loadMore();

      expect(store.hasMore).toBe(false);
      expect(api.tmdb.search).toHaveBeenCalledTimes(1);
    });

    it('keeps what was shown when the next page fails, to try again', async () => {
      api.tmdb.search.mockResolvedValueOnce({
        ok: false,
        error: { code: 'network' },
      });

      await store.loadMore();

      expect(store.moreFailed).toBe(true);
      expect(store.error).toBeNull();
      expect(store.results.map((item) => item.id)).toEqual([1, 2]);
    });

    it('drops a next page that comes after a new search', async () => {
      let answer!: (result: Result<Paged<SearchItem>>) => void;
      api.tmdb.search.mockReturnValueOnce(
        new Promise((resolve) => (answer = resolve)),
      );
      const more = store.loadMore();

      api.tmdb.search.mockResolvedValueOnce(page([9], 1));
      await store.search();
      answer(page([3, 4], 2));
      await more;

      expect(store.results.map((item) => item.id)).toEqual([9]);
      expect(store.loadingMore).toBe(false);
    });

    it('asks for one next page at a time', async () => {
      api.tmdb.search.mockResolvedValue(page([3, 4], 2));

      await Promise.all([store.loadMore(), store.loadMore()]);

      expect(api.tmdb.search).toHaveBeenCalledTimes(2);
    });
  });
});
