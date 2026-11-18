import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import type { MediaItem, Paged, Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import { useAccountListsStore } from '@/stores/accountLists';
import { useSessionStore } from '@/stores/session';
import { ANONYMOUS, installFakeApi, SIGNED_IN } from '@/test/fakeApi';

const MATRIX: MediaItem = { id: 603, media_type: 'movie', title: 'Matrix' };
const SHOW: MediaItem = { id: 1396, media_type: 'tv', name: 'Breaking Bad' };

const found = (
  results: MediaItem[],
  page = 1,
  totalResults = results.length,
): Result<Paged<MediaItem>> => ({
  ok: true,
  data: { page, results, totalPages: 0, totalResults },
});

describe('lists of the account', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useAccountListsStore>;

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    setActivePinia(createPinia());
    useSessionStore().state = SIGNED_IN;
    store = useAccountListsStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('starts with the first page of the movies, in the language of the app', async () => {
    i18n.global.locale.value = 'pt-BR';
    api.account.list.mockResolvedValue(found([MATRIX], 1, 21));

    await store.load('watchlist');

    expect(api.account.list).toHaveBeenCalledWith({
      list: 'watchlist',
      type: 'movie',
      page: 1,
      language: 'pt-BR',
    });
    expect(store.views.watchlist).toMatchObject({
      type: 'movie',
      page: 1,
      results: [MATRIX],
      totalResults: 21,
      loaded: true,
      loading: false,
    });
    // the other list is apart
    expect(store.views.favorite.loaded).toBe(false);
  });

  it('keeps what it shows while asking again, then shows the answer', async () => {
    api.account.list.mockResolvedValue(found([MATRIX]));
    await store.load('favorite');
    let answer!: (result: Result<Paged<MediaItem>>) => void;
    api.account.list.mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );

    const loading = store.load('favorite');

    expect(store.views.favorite.results).toEqual([MATRIX]);
    expect(store.views.favorite.loading).toBe(true);

    answer(found([]));
    await loading;

    expect(store.views.favorite.results).toEqual([]);
  });

  it('shows nothing of the movies while the tv shows load', async () => {
    api.account.list.mockResolvedValue(found([MATRIX]));
    await store.load('watchlist');
    api.account.list.mockReturnValue(new Promise(() => {}));

    void store.load('watchlist', 'tv');

    expect(store.views.watchlist).toMatchObject({
      type: 'tv',
      results: [],
      loaded: false,
    });
  });

  it('drops an older answer', async () => {
    let older!: (result: Result<Paged<MediaItem>>) => void;
    api.account.list
      .mockReturnValueOnce(new Promise((resolve) => (older = resolve)))
      .mockResolvedValueOnce(found([SHOW]));

    const first = store.load('watchlist', 'movie');
    await store.load('watchlist', 'tv');
    older(found([MATRIX]));
    await first;

    expect(store.views.watchlist.results).toEqual([SHOW]);
  });

  it('asks again for every page shown, fewer when titles are gone', async () => {
    store.views.watchlist.page = 3;
    // Two pages of titles now, on the TMDB website.
    api.account.list.mockImplementation(async ({ page }) =>
      found(page === 1 ? [MATRIX] : page === 2 ? [SHOW] : [], page, 21),
    );

    await store.load('watchlist');

    expect(api.account.list).toHaveBeenCalledTimes(3);
    expect(store.views.watchlist).toMatchObject({
      page: 2,
      results: [MATRIX, SHOW],
    });
  });

  describe('more at the end', () => {
    beforeEach(async () => {
      api.account.list.mockResolvedValueOnce(found([MATRIX], 1, 21));
      await store.load('watchlist');
    });

    it('adds the next page after the ones shown', async () => {
      api.account.list.mockResolvedValueOnce(found([SHOW], 2, 21));

      await store.loadMore('watchlist');

      expect(api.account.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ list: 'watchlist', page: 2 }),
      );
      expect(store.views.watchlist).toMatchObject({
        page: 2,
        results: [MATRIX, SHOW],
      });
    });

    it('stops at the last page', async () => {
      store.views.watchlist.page = 2;

      await store.loadMore('watchlist');

      expect(api.account.list).toHaveBeenCalledTimes(1);
    });

    it('keeps what was shown when the next page fails', async () => {
      api.account.list.mockResolvedValueOnce({
        ok: false,
        error: { code: 'network' },
      });

      await store.loadMore('watchlist');

      expect(store.views.watchlist).toMatchObject({
        moreFailed: true,
        error: null,
        results: [MATRIX],
      });
    });
  });

  it('asks who is signed in when TMDB says nobody is', async () => {
    api.account.list.mockResolvedValue({
      ok: false,
      error: { code: 'signed-out' },
    });

    await store.load('favorite');

    // which signs the user out here too, and empties the lists
    expect(api.auth.getSession).toHaveBeenCalled();
  });

  it('forgets the lists of whoever signs out', async () => {
    api.account.list.mockResolvedValue(found([MATRIX]));
    await store.load('watchlist');

    useSessionStore().state = ANONYMOUS;
    await nextTick();

    expect(store.views.watchlist.results).toEqual([]);
  });
});
