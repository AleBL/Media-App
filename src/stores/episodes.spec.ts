import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import type { Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import { useEpisodesStore } from '@/stores/episodes';
import { useSessionStore } from '@/stores/session';
import { today, useWatchedStore } from '@/stores/watched';
import { BREAKING_BAD, installFakeApi, SIGNED_IN } from '@/test/fakeApi';

const SHOW = { type: 'tv', id: BREAKING_BAD.id } as const;
const numbers = (count: number) =>
  Array.from({ length: count }, (_, index) => index + 1);
// Everything out of BREAKING_BAD: 7 and 13 episodes.
const ALL = { 1: numbers(7), 2: numbers(13) };

describe('episodes store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useEpisodesStore>;
  let watched: ReturnType<typeof useWatchedStore>;

  /** Signed in, with these episodes and the show marked watched or not. */
  async function setup(seasons?: Record<number, number[]>, whole = false) {
    api.watched.progress.mockResolvedValue({
      ok: true,
      data: seasons
        ? [{ id: BREAKING_BAD.id, seasons, changedAt: '2026-11-19' }]
        : [],
    });
    api.watched.state.mockResolvedValue({ ok: true, data: whole });
    await Promise.all([store.load(), watched.load(SHOW)]);
  }

  const lastSave = () => api.watched.saveProgress.mock.lastCall?.[0];
  const marks = () =>
    api.watched.mark.mock.calls.map(([request]) => request.value);

  beforeEach(() => {
    i18n.global.locale.value = 'pt-BR';
    api = installFakeApi();
    setActivePinia(createPinia());
    useSessionStore().state = SIGNED_IN;
    store = useEpisodesStore();
    watched = useWatchedStore();
  });

  afterEach(() => {
    i18n.global.locale.value = 'en';
    delete window.api;
  });

  it('reads the episodes of every show once', async () => {
    await setup({ 1: [1, 2] });
    await store.load();

    expect(api.watched.progress).toHaveBeenCalledOnce();
    expect(store.seasonsOf(BREAKING_BAD)).toEqual({ 1: [1, 2] });
  });

  it('reads them again after it failed', async () => {
    api.watched.progress.mockResolvedValueOnce({
      ok: false,
      error: { code: 'network' },
    });

    await store.load();

    expect(store.error).toEqual({ code: 'network' });
    expect(store.seasonsOf(BREAKING_BAD)).toBeUndefined();

    await store.load();

    expect(store.error).toBeNull();
    expect(store.loaded).toBe(true);
  });

  it('asks to sign in again without the access token of the user', async () => {
    api.watched.progress.mockResolvedValue({
      ok: false,
      error: { code: 'sign-in-again' },
    });

    await store.load();

    expect(watched.needsSignIn).toBe(true);
  });

  it('knows nothing of a show until it knows whether it was watched', async () => {
    await store.load();

    expect(store.seasonsOf(BREAKING_BAD)).toBeUndefined();
  });

  it('counts a show marked watched before it had episodes as every episode out', async () => {
    await setup(undefined, true);

    expect(store.seasonsOf(BREAKING_BAD)).toEqual(ALL);
  });

  it('shows a change at once, then saves it with the day and the language', async () => {
    await setup({ 1: [1] });

    const saving = store.change(BREAKING_BAD, { 1: [1, 2] });

    expect(store.seasonsOf(BREAKING_BAD)).toEqual({ 1: [1, 2] });
    await expect(saving).resolves.toEqual({ ok: true, data: null });
    expect(lastSave()).toEqual({
      id: BREAKING_BAD.id,
      seasons: { 1: [1, 2] },
      date: today(),
      language: 'pt-BR',
    });
    // without Vue's proxies, which IPC cannot send
    expect(() => structuredClone(lastSave())).not.toThrow();
  });

  it('marks the show watched with the last episode out', async () => {
    await setup({ 1: numbers(7), 2: numbers(12) });

    await store.change(BREAKING_BAD, ALL);

    expect(marks()).toEqual([true]);
    expect(watched.stateOf(SHOW)).toBe(true);
  });

  it('unmarks a watched show when an episode is taken away, not a special', async () => {
    await setup({ ...ALL, 0: [1] }, true);

    await store.change(BREAKING_BAD, ALL);

    expect(marks()).toEqual([]);

    await store.change(BREAKING_BAD, { ...ALL, 2: numbers(12) });

    expect(marks()).toEqual([false]);
  });

  it('keeps a watched show watched when an episode comes out after', async () => {
    const twoMore = {
      ...BREAKING_BAD,
      seasonList: [
        ...BREAKING_BAD.seasonList!,
        { number: 3, name: 'Season 3', episodeCount: 2 },
      ],
      lastEpisode: { season: 3, number: 2 },
    };

    await setup(ALL, true);
    await store.change(twoMore, { ...ALL, 3: [1] });

    expect(marks()).toEqual([]);
  });

  it('saves the changes of a show one at a time, the last one winning', async () => {
    await setup({});

    let answer: (result: Result<null>) => void = () => {};

    api.watched.saveProgress.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );

    const first = store.change(BREAKING_BAD, { 1: [1] });
    const second = store.change(BREAKING_BAD, { 1: [1, 2] });
    const third = store.change(BREAKING_BAD, { 1: [1, 2, 3] });

    expect(api.watched.saveProgress).toHaveBeenCalledOnce();

    answer({ ok: true, data: null });
    await Promise.all([first, second, third]);

    expect(
      api.watched.saveProgress.mock.calls.map(([request]) => request.seasons),
    ).toEqual([{ 1: [1] }, { 1: [1, 2, 3] }]);
  });

  it('goes back to what TMDB has when it refuses a change', async () => {
    await setup({ 1: [1] });
    api.watched.saveProgress.mockResolvedValue({
      ok: false,
      error: { code: 'server' },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      store.change(BREAKING_BAD, { 1: [1, 2] }),
    ).resolves.toMatchObject({ ok: false });
    expect(store.seasonsOf(BREAKING_BAD)).toEqual({ 1: [1] });
  });

  it('changes the episodes of a show even when TMDB did not say whether it was watched', async () => {
    api.watched.progress.mockResolvedValue({
      ok: true,
      data: [
        { id: BREAKING_BAD.id, seasons: { 1: [1] }, changedAt: '2026-11-19' },
      ],
    });
    api.watched.state.mockResolvedValue({
      ok: false,
      error: { code: 'network' },
    });
    await Promise.all([store.load(), watched.load(SHOW)]);

    expect(store.snapshot(BREAKING_BAD)).toEqual({
      seasons: { 1: [1] },
      whole: undefined,
    });
    await store.change(BREAKING_BAD, ALL);

    expect(lastSave()?.seasons).toEqual(ALL);
    // nothing known to change it from
    expect(marks()).toEqual([]);
  });

  it('marks every episode out with the show, the specials as they were', async () => {
    await setup({ 0: [2], 2: [5] });

    await expect(store.markShow(BREAKING_BAD, true)).resolves.toEqual({
      ok: true,
      data: null,
    });
    expect(lastSave()?.seasons).toEqual({ ...ALL, 0: [2] });
    expect(marks()).toEqual([true]);
  });

  it('takes every episode away with the show', async () => {
    await setup(ALL, true);

    await store.markShow(BREAKING_BAD, false);

    expect(lastSave()?.seasons).toEqual({});
    expect(marks()).toEqual([false]);
  });

  it('marks a show with nothing out without saving episodes', async () => {
    await setup();

    await store.markShow({ ...BREAKING_BAD, lastEpisode: undefined }, true);

    expect(api.watched.saveProgress).not.toHaveBeenCalled();
    expect(marks()).toEqual([true]);
  });

  it('goes back to what a show was, episodes and mark', async () => {
    await setup({ 1: [1, 2] });
    const before = store.snapshot(BREAKING_BAD)!;

    await store.markShow(BREAKING_BAD, true);
    await store.restore(BREAKING_BAD, before);

    expect(store.seasonsOf(BREAKING_BAD)).toEqual({ 1: [1, 2] });
    expect(lastSave()?.seasons).toEqual({ 1: [1, 2] });
    expect(marks()).toEqual([true, false]);
  });

  it('forgets everything when someone else signs in', async () => {
    await setup({ 1: [1] });

    useSessionStore().state = {
      status: 'authenticated',
      account: { id: 99, username: 'grace' },
    };
    await nextTick();

    expect(store.loaded).toBe(false);
    expect(store.seasonsOf(BREAKING_BAD)).toBeUndefined();
  });
});
