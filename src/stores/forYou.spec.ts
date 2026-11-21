import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { MediaItem, Paged, Result } from '@shared/api';
import { useAccountStore } from '@/stores/account';
import { useEpisodesStore } from '@/stores/episodes';
import { useForYouStore } from '@/stores/forYou';
import { useSessionStore } from '@/stores/session';
import { useWatchedStore } from '@/stores/watched';
import { ANONYMOUS, installFakeApi, pageOf, SIGNED_IN } from '@/test/fakeApi';

const movie = (id: number): MediaItem => ({
  id,
  media_type: 'movie',
  title: `Movie ${id}`,
});
const show = (id: number): MediaItem => ({
  id,
  media_type: 'tv',
  name: `Show ${id}`,
});

const ids = (items: MediaItem[]) =>
  items.map((item) => `${item.media_type}:${item.id}`);

describe('for you store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let session: ReturnType<typeof useSessionStore>;
  let store: ReturnType<typeof useForYouStore>;

  beforeEach(() => {
    api = installFakeApi();
    api.account.recommendations.mockImplementation(async ({ type }) => ({
      ok: true,
      data: type === 'movie' ? [movie(1), movie(2), movie(3)] : [show(1)],
    }));
    setActivePinia(createPinia());
    session = useSessionStore();
    session.state = SIGNED_IN;
    store = useForYouStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('asks for the movies and the tv shows, in the language, once', async () => {
    await store.load('pt-BR');
    await store.load('pt-BR');

    expect(api.account.recommendations.mock.calls).toEqual([
      [{ type: 'movie', language: 'pt-BR' }],
      [{ type: 'tv', language: 'pt-BR' }],
    ]);
    expect(ids(store.shown('movie'))).toEqual([
      'movie:1',
      'movie:2',
      'movie:3',
    ]);
    expect(ids(store.shown('tv'))).toEqual(['tv:1']);

    await store.load('es');

    expect(api.account.recommendations).toHaveBeenCalledTimes(4);
  });

  it('shows both in turn: a movie, a tv show, a movie', async () => {
    await store.load('en');

    expect(ids(store.shown('all'))).toEqual([
      'movie:1',
      'tv:1',
      'movie:2',
      'movie:3',
    ]);
  });

  it('leaves out what the user has already, as far as the app knows', async () => {
    api.account.list.mockImplementation(async ({ list, type }) => ({
      ok: true,
      data: pageOf(
        list === 'watchlist' && type === 'movie'
          ? [movie(1)]
          : list === 'favorite' && type === 'movie'
            ? [movie(2)]
            : [],
      ) as Paged<MediaItem>,
    }));
    api.account.recommendations.mockImplementation(async ({ type }) => ({
      ok: true,
      data:
        type === 'movie'
          ? [movie(1), movie(2), movie(3), movie(4), movie(5)]
          : [show(1), show(2)],
    }));
    const account = useAccountStore();
    await account.loadLists();
    // rated and watched, on the page of each title
    account.ratings['movie-3'] = 7;
    useWatchedStore().states['movie-4'] = true;
    // episodes watched of one show; every episode taken back of the other
    useEpisodesStore().shows[1] = { 1: [1, 2] };
    useEpisodesStore().shows[2] = { 1: [] };

    await store.load('en');

    expect(ids(store.shown('all'))).toEqual(['movie:5', 'tv:2']);
  });

  it('keeps a failure, and asks again after it', async () => {
    api.account.recommendations.mockResolvedValueOnce({
      ok: false,
      error: { code: 'server', status: 500 },
    });

    await store.load('en');

    expect(store.error).toEqual({ code: 'server', status: 500 });
    expect(store.shown('all')).toEqual([]);

    await store.load('en');

    expect(api.account.recommendations).toHaveBeenCalledTimes(4);
    expect(store.error).toBeNull();
    expect(store.shown('all')).toHaveLength(4);
  });

  it('reads the session again when TMDB says nobody is signed in', async () => {
    api.account.recommendations.mockResolvedValue({
      ok: false,
      error: { code: 'signed-out' },
    });
    api.auth.getSession.mockResolvedValue(ANONYMOUS);

    await store.load('en');
    await flushPromises();

    expect(api.auth.getSession).toHaveBeenCalled();
    expect(session.account).toBeNull();
  });

  it('asks nothing for nobody signed in', async () => {
    session.state = ANONYMOUS;
    await nextTick();

    await store.load('en');

    expect(api.account.recommendations).not.toHaveBeenCalled();
  });

  it('forgets the titles of an account that signed out, even on their way', async () => {
    let answer!: (result: Result<MediaItem[]>) => void;
    api.account.recommendations.mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );

    const loading = store.load('en');
    session.state = ANONYMOUS;
    await nextTick();
    answer({ ok: true, data: [movie(9)] });
    await loading;

    expect(store.shown('all')).toEqual([]);
    expect(store.loading).toBe(false);
  });
});
