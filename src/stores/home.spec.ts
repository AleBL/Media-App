import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { MediaItem, Result } from '@shared/api';
import { useHomeStore, type RowRequest } from '@/stores/home';
import { installFakeApi } from '@/test/fakeApi';

const MATRIX: MediaItem = { id: 603, media_type: 'movie', title: 'Matrix' };
const DUNE: MediaItem = { id: 438631, media_type: 'movie', title: 'Dune' };

const trending = (language = 'en'): RowRequest => ({
  list: { list: 'trending', language },
});

const comedies = {
  discover: {
    type: 'movie',
    page: 1,
    language: 'en',
    region: 'BR',
    sort: 'popularity',
    genres: [35],
  },
} satisfies RowRequest;

describe('home store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useHomeStore>;

  beforeEach(() => {
    api = installFakeApi();
    api.tmdb.list.mockResolvedValue({ ok: true, data: [MATRIX] });
    api.tmdb.discover.mockResolvedValue({
      ok: true,
      data: { page: 1, results: [DUNE], totalPages: 9, totalResults: 170 },
    });
    setActivePinia(createPinia());
    store = useHomeStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('loads a list of TMDB, and the first page of a discovery, by row', async () => {
    await store.load('list:trending', trending());
    await store.load('discover:genres=35', comedies);

    expect(api.tmdb.list).toHaveBeenCalledWith({
      list: 'trending',
      language: 'en',
    });
    expect(api.tmdb.discover).toHaveBeenCalledWith(comedies.discover);
    expect(store.stateOf('list:trending').items).toEqual([MATRIX]);
    expect(store.stateOf('discover:genres=35').items).toEqual([DUNE]);
    expect(store.stateOf('list:other')).toMatchObject({
      items: [],
      key: null,
      loading: false,
    });
  });

  it('does not ask again for a row it has, or has on its way', async () => {
    await Promise.all([
      store.load('list:trending', trending()),
      store.load('list:trending', trending()),
    ]);
    await store.load('list:trending', trending());

    expect(api.tmdb.list).toHaveBeenCalledTimes(1);
  });

  it('asks again in another language, keeping the titles meanwhile', async () => {
    await store.load('list:trending', trending());
    api.tmdb.list.mockResolvedValue({ ok: true, data: [DUNE] });

    const next = store.load('list:trending', trending('pt-BR'));

    expect(store.stateOf('list:trending')).toMatchObject({
      items: [MATRIX],
      loading: true,
    });
    await next;
    expect(store.stateOf('list:trending').items).toEqual([DUNE]);
  });

  it('drops an answer in the language left behind', async () => {
    let answer!: (value: Result<MediaItem[]>) => void;

    api.tmdb.list
      .mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
      .mockResolvedValueOnce({ ok: true, data: [DUNE] });

    const first = store.load('list:trending', trending());
    await store.load('list:trending', trending('es'));
    answer({ ok: true, data: [MATRIX] });
    await first;

    expect(store.stateOf('list:trending').items).toEqual([DUNE]);
  });

  it('keeps the failure of a row, and asks for it again', async () => {
    api.tmdb.list.mockResolvedValueOnce({
      ok: false,
      error: { code: 'network' },
    });

    await store.load('list:trending', trending());

    expect(store.failure).toEqual({ code: 'network' });

    await store.load('list:trending', trending(), true);

    expect(store.failure).toBeNull();
    expect(store.stateOf('list:trending').items).toEqual([MATRIX]);
  });

  it('turns a call that throws into a failure', async () => {
    api.tmdb.discover.mockRejectedValueOnce(new Error('gone'));

    await store.load('discover:genres=35', comedies);

    expect(store.stateOf('discover:genres=35').error).toMatchObject({
      code: 'server',
      message: 'gone',
    });
  });

  it('forgets the rows that failed, for them to be asked again', async () => {
    api.tmdb.list.mockResolvedValueOnce({
      ok: false,
      error: { code: 'unauthorized', status: 401 },
    });
    await store.load('list:trending', trending());
    await store.load('discover:genres=35', comedies);

    store.forgetFailures();

    expect(store.failure).toBeNull();
    expect(store.stateOf('list:trending').key).toBeNull();
    expect(store.stateOf('discover:genres=35').items).toEqual([DUNE]);
  });
});
