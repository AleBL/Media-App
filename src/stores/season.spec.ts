import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Result, SeasonDetails } from '@shared/api';
import i18n from '@/plugins/i18n';
import { useSeasonStore } from '@/stores/season';
import { installFakeApi, SEASON_ONE } from '@/test/fakeApi';

describe('season store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useSeasonStore>;

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    setActivePinia(createPinia());
    store = useSeasonStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('asks for the season in the language of the app', async () => {
    i18n.global.locale.value = 'pt-BR';

    await store.load(1396, 1);

    expect(api.tmdb.season).toHaveBeenCalledWith({
      id: 1396,
      season: 1,
      language: 'pt-BR',
    });
    expect(store.season).toEqual(SEASON_ONE);
    expect(store.loading).toBe(false);
  });

  it('keeps the failure, and nothing of the season', async () => {
    api.tmdb.season.mockResolvedValueOnce({
      ok: false,
      error: { code: 'not-found', status: 404 },
    });

    await store.load(1396, 9);

    expect(store.error).toEqual({ code: 'not-found', status: 404 });
    expect(store.season).toBeNull();
  });

  it('turns a call that throws into a failure', async () => {
    api.tmdb.season.mockRejectedValueOnce(new Error('gone'));

    await store.load(1396, 1);

    expect(store.error).toMatchObject({ code: 'server', message: 'gone' });
  });

  it('keeps the season while asking again, and shows no other meanwhile', async () => {
    await store.load(1396, 1);
    api.tmdb.season.mockReturnValue(new Promise(() => {}));

    void store.load(1396, 1);
    expect(store.season).toEqual(SEASON_ONE);

    void store.load(1396, 2);
    expect(store.season).toBeNull();
  });

  it('ignores the answer about a season the user already left', async () => {
    let answer!: (value: Result<SeasonDetails>) => void;

    api.tmdb.season
      .mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
      .mockResolvedValueOnce({
        ok: true,
        data: { ...SEASON_ONE, number: 2 },
      });

    const first = store.load(1396, 1);
    await store.load(1396, 2);
    answer({ ok: true, data: SEASON_ONE });
    await first;

    expect(store.season?.number).toBe(2);
  });
});
