import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import type { Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import { useSessionStore } from '@/stores/session';
import { today, useWatchedStore } from '@/stores/watched';
import { ANONYMOUS, installFakeApi, SIGNED_IN } from '@/test/fakeApi';

const MATRIX = { type: 'movie', id: 603 } as const;

describe('watched store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useWatchedStore>;
  let session: ReturnType<typeof useSessionStore>;

  beforeEach(() => {
    i18n.global.locale.value = 'pt-BR';
    api = installFakeApi();
    setActivePinia(createPinia());
    session = useSessionStore();
    session.state = SIGNED_IN;
    store = useWatchedStore();
  });

  afterEach(() => {
    i18n.global.locale.value = 'en';
    delete window.api;
  });

  it('writes the day of the user as the list keeps it', () => {
    expect(today(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('learns whether a title was watched', async () => {
    api.watched.state.mockResolvedValue({ ok: true, data: true });

    expect(store.stateOf(MATRIX)).toBeUndefined();

    await store.load(MATRIX);

    expect(api.watched.state).toHaveBeenCalledWith(MATRIX);
    expect(store.stateOf(MATRIX)).toBe(true);
  });

  it('marks it watched at once, today, in the language of the app', async () => {
    await store.load(MATRIX);
    let answer!: (result: Result<null>) => void;
    api.watched.mark.mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );

    const marking = store.toggle(MATRIX);

    expect(store.stateOf(MATRIX)).toBe(true);
    expect(store.isSaving(MATRIX)).toBe(true);
    expect(api.watched.mark).toHaveBeenCalledWith({
      ...MATRIX,
      value: true,
      date: today(),
      language: 'pt-BR',
    });

    answer({ ok: true, data: null });
    await marking;

    expect(store.isSaving(MATRIX)).toBe(false);
  });

  it('undoes a mark that TMDB did not take, and says how it failed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await store.load(MATRIX);
    const failure = {
      code: 'not-found',
      status: 404,
      message: 'Not found.',
    } as const;
    api.watched.mark.mockResolvedValue({ ok: false, error: failure });

    await expect(store.toggle(MATRIX)).resolves.toMatchObject({ ok: false });

    expect(store.stateOf(MATRIX)).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.any(String), failure);
    warn.mockRestore();
  });

  it('does nothing before TMDB said, nor twice at once', async () => {
    await expect(store.toggle(MATRIX)).resolves.toBeUndefined();

    await store.load(MATRIX);
    api.watched.mark.mockReturnValue(new Promise(() => {}));
    void store.toggle(MATRIX);
    await expect(store.toggle(MATRIX)).resolves.toBeUndefined();

    expect(api.watched.mark).toHaveBeenCalledOnce();
  });

  it('learns that signing in again is needed', async () => {
    api.watched.state.mockResolvedValue({
      ok: false,
      error: { code: 'sign-in-again' },
    });

    await store.load(MATRIX);

    expect(store.needsSignIn).toBe(true);
    expect(store.stateOf(MATRIX)).toBeUndefined();
  });

  it('reads a page of the watched titles', async () => {
    api.watched.list.mockResolvedValue({
      ok: true,
      data: {
        page: 2,
        results: [{ id: 603, media_type: 'movie', watchedAt: '2026-11-16' }],
        totalPages: 2,
        totalResults: 21,
      },
    });

    await store.loadPage(2);

    expect(api.watched.list).toHaveBeenCalledWith({
      page: 2,
      language: 'pt-BR',
    });
    expect(store.view).toMatchObject({
      page: 2,
      totalResults: 21,
      loaded: true,
      loading: false,
      error: null,
    });
  });

  it('goes back a page when the last one emptied', async () => {
    api.watched.list.mockImplementation(async ({ page }) => ({
      ok: true,
      data: {
        page,
        results: page === 1 ? [{ id: 603, media_type: 'movie' }] : [],
        totalPages: 1,
        totalResults: 1,
      },
    }));

    await store.loadPage(2);

    expect(api.watched.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
    );
    expect(store.view.page).toBe(1);
  });

  it('forgets everything when the user signs out', async () => {
    api.watched.state.mockResolvedValue({
      ok: false,
      error: { code: 'sign-in-again' },
    });
    await store.load(MATRIX);

    session.state = ANONYMOUS;
    await nextTick();

    expect(store.needsSignIn).toBe(false);
    expect(store.states).toEqual({});
  });
});
