import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ShowProgress } from '@shared/api';
import i18n from '@/plugins/i18n';
import { KEEP_MS, useContinueStore } from '@/stores/continue';
import { useEpisodesStore } from '@/stores/episodes';
import { useSessionStore } from '@/stores/session';
import { BREAKING_BAD, installFakeApi, SIGNED_IN } from '@/test/fakeApi';

const numbers = (count: number) =>
  Array.from({ length: count }, (_, index) => index + 1);

describe('continue store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useContinueStore>;

  /** Signed in, with these shows in progress, then everything asked. */
  async function setup(shows: ShowProgress[]) {
    api.watched.progress.mockResolvedValue({ ok: true, data: shows });
    await useEpisodesStore().load();
    await store.load();
  }

  const show = (
    id: number,
    seasons: Record<number, number[]>,
    day: string,
  ) => ({
    id,
    seasons,
    changedAt: day,
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 20, 12));
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    api.tmdb.details.mockImplementation(async ({ id }) => ({
      ok: true,
      data: { ...BREAKING_BAD, id, title: `Show ${id}` },
    }));
    setActivePinia(createPinia());
    useSessionStore().state = SIGNED_IN;
    store = useContinueStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.api;
  });

  it('lists each show with the episode after the furthest one watched, the last changed first', async () => {
    await setup([
      show(1, { 1: [1] }, '2026-11-10'),
      show(2, { 1: [1, 2, 3, 5] }, '2026-11-19'),
    ]);

    expect(
      store.list.map(({ show: { id }, next, episode }) => [
        id,
        next,
        episode?.name,
      ]),
    ).toEqual([
      // SEASON_ONE has no episode 6: a name only once TMDB has it
      [2, { season: 1, number: 6 }, undefined],
      [1, { season: 1, number: 2 }, "Cat's in the Bag..."],
    ]);
    expect(store.list[1]).toMatchObject({ watched: 1, out: 20 });
    expect(api.tmdb.season).toHaveBeenCalledWith({
      id: 1,
      season: 1,
      language: 'en',
    });
  });

  it('keeps the order of the changes of the same day', async () => {
    await setup([
      show(1, { 1: [1] }, '2026-11-20T21:05'),
      show(2, { 1: [1] }, '2026-11-20T09:00'),
      show(3, { 1: [1] }, '2026-11-20T21:30'),
    ]);

    expect(store.list.map(({ show: { id } }) => id)).toEqual([3, 1, 2]);
  });

  it('leaves out a show with every episode out watched', async () => {
    await setup([show(1, { 1: numbers(7), 2: numbers(13) }, '2026-11-10')]);

    expect(store.list).toEqual([]);
    expect(store.followed).toEqual([1]);
  });

  it('says an episode is new when it came out after the last change, and puts it first', async () => {
    await setup([
      show(1, { 1: [1] }, '2008-01-21'),
      show(2, { 1: [1] }, '2008-02-01'),
    ]);

    // episode 2 came out on 2008-01-27: after the first change, not after
    // the second
    expect(
      store.list.map(({ show: { id }, isNew, activity }) => [
        id,
        isNew,
        activity,
      ]),
    ).toEqual([
      [2, false, '2008-02-01'],
      [1, true, '2008-01-27'],
    ]);
  });

  it('keeps the pages of the shows for a while, then asks again', async () => {
    await setup([show(1, { 1: [1] }, '2026-11-10')]);
    await store.load();

    expect(api.tmdb.details).toHaveBeenCalledOnce();
    expect(api.tmdb.season).toHaveBeenCalledOnce();

    vi.setSystemTime(Date.now() + KEEP_MS + 1);
    await store.load();

    expect(api.tmdb.details).toHaveBeenCalledTimes(2);
  });

  it('asks again in another language', async () => {
    await setup([show(1, { 1: [1] }, '2026-11-10')]);

    i18n.global.locale.value = 'pt-BR';
    await store.load();

    expect(api.tmdb.details).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 1, language: 'pt-BR' }),
    );
    i18n.global.locale.value = 'en';
  });

  it('fails only when nothing could be asked and there is nothing to show', async () => {
    api.tmdb.details.mockResolvedValue({
      ok: false,
      error: { code: 'network' },
    });

    await setup([show(1, { 1: [1] }, '2026-11-10')]);

    expect(store.failed).toBe(true);
    expect(store.list).toEqual([]);
  });
});
