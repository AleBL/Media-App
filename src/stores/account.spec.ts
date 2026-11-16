import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { Result } from '@shared/api';
import { MAX_LIST_PAGES, useAccountStore } from '@/stores/account';
import { useSessionStore } from '@/stores/session';
import { ANONYMOUS, installFakeApi, SIGNED_IN } from '@/test/fakeApi';

const MATRIX = { type: 'movie', id: 603 } as const;

describe('account store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useAccountStore>;
  let session: ReturnType<typeof useSessionStore>;

  beforeEach(() => {
    api = installFakeApi();
    setActivePinia(createPinia());
    session = useSessionStore();
    session.state = SIGNED_IN;
    store = useAccountStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('learns where a title is', async () => {
    api.account.states.mockResolvedValue({
      ok: true,
      data: { watchlist: true, favorite: false },
    });

    await store.load(MATRIX);

    expect(api.account.states).toHaveBeenCalledWith(MATRIX);
    expect(store.statesOf(MATRIX)).toEqual({
      watchlist: true,
      favorite: false,
    });
  });

  it('shows a change at once, before TMDB answers', async () => {
    await store.load(MATRIX);
    let answer!: (result: Result<null>) => void;
    api.account.mark.mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );

    const change = store.toggle('favorite', MATRIX);

    expect(store.statesOf(MATRIX)).toEqual({
      watchlist: false,
      favorite: true,
    });
    expect(store.isSaving('favorite', MATRIX)).toBe(true);
    expect(api.account.mark).toHaveBeenCalledWith({
      ...MATRIX,
      list: 'favorite',
      value: true,
    });

    answer({ ok: true, data: null });
    await change;

    expect(store.statesOf(MATRIX)?.favorite).toBe(true);
    expect(store.isSaving('favorite', MATRIX)).toBe(false);
  });

  it('undoes a change that TMDB did not take', async () => {
    await store.load(MATRIX);
    api.account.mark.mockResolvedValue({
      ok: false,
      error: { code: 'network' },
    });

    const answer = await store.toggle('watchlist', MATRIX);

    expect(answer).toEqual({ ok: false, error: { code: 'network' } });
    expect(store.statesOf(MATRIX)).toEqual({
      watchlist: false,
      favorite: false,
    });
  });

  it('takes a change that throws as a failure', async () => {
    await store.load(MATRIX);
    api.account.mark.mockRejectedValue(new Error('No handler registered'));

    const answer = await store.toggle('watchlist', MATRIX);

    expect(answer).toMatchObject({ ok: false, error: { code: 'server' } });
    expect(store.statesOf(MATRIX)?.watchlist).toBe(false);
  });

  it('does nothing before it knows where the title is, nor twice at once', async () => {
    // neither from the title nor from the lists
    store.lists = null;
    await expect(store.toggle('watchlist', MATRIX)).resolves.toBeUndefined();

    await store.load(MATRIX);
    api.account.mark.mockReturnValue(new Promise(() => {}));
    void store.toggle('watchlist', MATRIX);
    await expect(store.toggle('watchlist', MATRIX)).resolves.toBeUndefined();

    expect(api.account.mark).toHaveBeenCalledOnce();
  });

  it('asks who is signed in when TMDB says nobody is', async () => {
    await store.load(MATRIX);
    api.account.mark.mockResolvedValue({
      ok: false,
      error: { code: 'signed-out' },
    });

    await store.toggle('watchlist', MATRIX);

    expect(api.auth.getSession).toHaveBeenCalled();
  });

  it('forgets everything when the user signs out', async () => {
    await store.load(MATRIX);

    session.state = ANONYMOUS;
    await nextTick();

    expect(store.statesOf(MATRIX)).toBeUndefined();
    expect(store.lists).toBeNull();
  });

  describe('the lists, read for the cards', () => {
    /** A list of the account with these titles, 20 to a page. */
    function listing(titles: Record<string, number[]>) {
      api.account.list.mockImplementation(async ({ list, type, page }) => {
        const ids = titles[`${list}:${type}`] ?? [];

        return {
          ok: true,
          data: {
            page,
            results: ids
              .slice((page - 1) * 20, page * 20)
              .map((id) => ({ id, media_type: type })),
            totalPages: Math.ceil(ids.length / 20),
            totalResults: ids.length,
          },
        };
      });
    }

    async function signIn() {
      session.state = ANONYMOUS;
      await nextTick();
      // only what this sign in asks for
      api.account.list.mockClear();
      session.state = SIGNED_IN;
      await flushPromises();
    }

    it('reads the four of them at sign in, and tells where every title is', async () => {
      listing({
        'watchlist:movie': [603],
        'watchlist:tv': [1396],
        'favorite:movie': [603, 604],
      });

      await signIn();

      expect(
        api.account.list.mock.calls.map(
          ([{ list, type }]) => `${list}:${type}`,
        ),
      ).toEqual(
        expect.arrayContaining([
          'watchlist:movie',
          'watchlist:tv',
          'favorite:movie',
          'favorite:tv',
        ]),
      );
      expect(store.statesOf(MATRIX)).toEqual({
        watchlist: true,
        favorite: true,
      });
      expect(store.statesOf({ type: 'tv', id: 1396 })).toEqual({
        watchlist: true,
        favorite: false,
      });
      // the same id, another type
      expect(store.statesOf({ type: 'tv', id: 603 })).toEqual({
        watchlist: false,
        favorite: false,
      });
    });

    it(`reads up to ${MAX_LIST_PAGES} pages of each`, async () => {
      const many = Array.from(
        { length: 20 * (MAX_LIST_PAGES + 2) },
        (_, i) => i + 1,
      );
      listing({ 'watchlist:movie': many, 'favorite:tv': [1, 2, 3] });

      await signIn();

      const pages = api.account.list.mock.calls.filter(
        ([{ list, type }]) => list === 'watchlist' && type === 'movie',
      );
      expect(pages).toHaveLength(MAX_LIST_PAGES);
      expect(
        store.statesOf({ type: 'movie', id: 20 * MAX_LIST_PAGES })?.watchlist,
      ).toBe(true);
      // past what was read: taken for not being in the list
      expect(
        store.statesOf({ type: 'movie', id: 20 * MAX_LIST_PAGES + 1 })
          ?.watchlist,
      ).toBe(false);
      expect(store.statesOf({ type: 'tv', id: 2 })?.favorite).toBe(true);
    });

    it('knows nothing from them when one could not be read', async () => {
      listing({ 'watchlist:movie': [603] });
      const read = api.account.list.getMockImplementation()!;
      api.account.list.mockImplementation(async (request) =>
        request.list === 'favorite' && request.type === 'tv'
          ? { ok: false, error: { code: 'network' } }
          : read(request),
      );

      await signIn();

      expect(store.lists).toBeNull();
      expect(store.statesOf(MATRIX)).toBeUndefined();
    });

    it('lets what the page of a title learned, or a change, win over them', async () => {
      listing({ 'watchlist:movie': [603] });
      await signIn();
      api.account.states.mockResolvedValue({
        ok: true,
        data: { watchlist: false, favorite: true },
      });

      await store.load(MATRIX);

      expect(store.statesOf(MATRIX)).toEqual({
        watchlist: false,
        favorite: true,
      });

      await store.toggle('watchlist', { type: 'tv', id: 1396 });

      expect(store.statesOf({ type: 'tv', id: 1396 })?.watchlist).toBe(true);
      expect(api.account.mark).toHaveBeenCalledWith({
        type: 'tv',
        id: 1396,
        list: 'watchlist',
        value: true,
      });
    });

    it('drops a reading that someone else signing in made old', async () => {
      let older!: () => void;
      api.account.list.mockImplementation(
        () =>
          new Promise((resolve) => {
            older = () =>
              resolve({
                ok: true,
                data: {
                  page: 1,
                  results: [{ id: 603, media_type: 'movie' }],
                  totalPages: 1,
                  totalResults: 1,
                },
              });
          }),
      );
      await signIn();

      session.state = ANONYMOUS;
      await nextTick();
      older();
      await flushPromises();

      expect(store.lists).toBeNull();
    });
  });
});
