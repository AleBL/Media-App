import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { MediaDetails, Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import { useDetailsStore } from '@/stores/details';
import { installFakeApi, MATRIX } from '@/test/fakeApi';

const BREAKING_BAD: MediaDetails = {
  type: 'tv',
  id: 1396,
  title: 'Breaking Bad',
  genres: [],
  cast: [],
};

describe('details store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useDetailsStore>;

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR', 'pt']);
    api = installFakeApi();
    setActivePinia(createPinia());
    store = useDetailsStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('asks for the title in the language of the app and the region of the system', async () => {
    i18n.global.locale.value = 'es';

    await store.load('movie', 603);

    expect(api.tmdb.details).toHaveBeenCalledWith({
      type: 'movie',
      id: 603,
      language: 'es',
      region: 'BR',
    });
    expect(store.details).toEqual(MATRIX);
    expect(store.region).toBe('BR');
    expect(store.loading).toBe(false);
  });

  it('keeps the failure, and nothing of the title', async () => {
    api.tmdb.details.mockResolvedValue({
      ok: false,
      error: { code: 'not-found', status: 404 },
    });

    await store.load('movie', 999);

    expect(store.details).toBeNull();
    expect(store.error).toEqual({ code: 'not-found', status: 404 });
  });

  it('turns a call that throws into a failure', async () => {
    api.tmdb.details.mockRejectedValue(new Error('the preload script died'));

    await store.load('movie', 603);

    expect(store.error).toEqual({
      code: 'server',
      message: 'the preload script died',
    });
  });

  it('forgets the title shown before while another one loads', async () => {
    await store.load('movie', 603);
    api.tmdb.details.mockReturnValue(new Promise(() => {}));

    store.load('tv', 1396);

    expect(store.details).toBeNull();
    expect(store.loading).toBe(true);
  });

  it('keeps showing the same title while it loads in another language', async () => {
    await store.load('movie', 603);
    api.tmdb.details.mockReturnValue(new Promise(() => {}));

    i18n.global.locale.value = 'pt-BR';
    store.load('movie', 603);

    expect(store.details).toEqual(MATRIX);
    expect(store.loading).toBe(true);
  });

  it('drops the answer about a title the user already left', async () => {
    let answerMatrix!: (answer: Result<MediaDetails>) => void;
    api.tmdb.details
      .mockReturnValueOnce(new Promise((resolve) => (answerMatrix = resolve)))
      .mockResolvedValueOnce({ ok: true, data: BREAKING_BAD });

    const first = store.load('movie', 603);
    await store.load('tv', 1396);
    answerMatrix({ ok: true, data: MATRIX });
    await first;

    expect(store.details).toEqual(BREAKING_BAD);
  });
});
