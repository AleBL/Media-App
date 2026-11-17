import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { MediaItem, Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import { useHomeStore } from '@/stores/home';
import { installFakeApi } from '@/test/fakeApi';

const MATRIX: MediaItem = { id: 603, media_type: 'movie', title: 'Matrix' };

describe('home store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useHomeStore>;

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    api.tmdb.list.mockResolvedValue({ ok: true, data: [MATRIX] });
    setActivePinia(createPinia());
    store = useHomeStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('loads every list in the language of the app', async () => {
    i18n.global.locale.value = 'pt-BR';

    await store.load();

    expect(api.tmdb.list.mock.calls.map(([request]) => request)).toEqual([
      { list: 'trending', language: 'pt-BR' },
      { list: 'popular-movies', language: 'pt-BR' },
      { list: 'popular-tv', language: 'pt-BR' },
    ]);
    expect(store.lists.trending).toEqual({
      items: [MATRIX],
      language: 'pt-BR',
      loading: false,
      error: null,
    });
  });

  it('does not ask again for lists it has in that language', async () => {
    await store.load();
    await store.load();

    expect(api.tmdb.list).toHaveBeenCalledTimes(3);

    i18n.global.locale.value = 'es';
    await store.load();

    expect(api.tmdb.list).toHaveBeenCalledTimes(6);
  });

  it('keeps the failure of one list, and asks again for that one', async () => {
    api.tmdb.list.mockImplementation(async ({ list }) =>
      list === 'popular-tv'
        ? { ok: false, error: { code: 'network' } }
        : { ok: true, data: [MATRIX] },
    );

    await store.load();

    expect(store.lists['popular-tv'].error).toEqual({ code: 'network' });
    expect(store.lists['popular-movies'].items).toEqual([MATRIX]);

    await store.load();

    // only the one that failed
    expect(api.tmdb.list).toHaveBeenCalledTimes(4);
  });

  it('turns a call that throws into a failure', async () => {
    api.tmdb.list.mockRejectedValue(new Error('the preload script died'));

    await store.loadList('trending');

    expect(store.lists.trending.error).toEqual({
      code: 'server',
      message: 'the preload script died',
    });
  });

  it('drops an answer in the language left behind', async () => {
    let answerInEnglish!: (answer: Result<MediaItem[]>) => void;
    const inSpanish = { ...MATRIX, title: 'Matrix [es]' };
    api.tmdb.list
      .mockReturnValueOnce(
        new Promise((resolve) => (answerInEnglish = resolve)),
      )
      .mockResolvedValueOnce({ ok: true, data: [inSpanish] });

    const first = store.loadList('trending');
    i18n.global.locale.value = 'es';
    await store.loadList('trending');
    answerInEnglish({ ok: true, data: [MATRIX] });
    await first;

    expect(store.lists.trending.items).toEqual([inSpanish]);
    expect(store.lists.trending.language).toBe('es');
  });
});
