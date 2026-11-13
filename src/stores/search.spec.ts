import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { MediaItem, Paged, Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import { useSearchStore } from '@/stores/search';
import { installFakeApi, pageOf } from '@/test/fakeApi';

const MATRIX: MediaItem = { id: 603, title: 'The Matrix' };

function found(
  results: MediaItem[] = [MATRIX],
  overrides: Partial<Paged<MediaItem>> = {},
): Result<Paged<MediaItem>> {
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
    let answerSlow: (value: Result<Paged<MediaItem>>) => void = () => {};
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

  it('flags loading only while the request is in flight', async () => {
    let answer: (value: Result<Paged<MediaItem>>) => void = () => {};
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
});
