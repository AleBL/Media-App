import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import type { Result } from '@shared/api';
import { useAccountStore } from '@/stores/account';
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
  });
});
