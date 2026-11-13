import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useGenresStore } from '@/stores/genres';
import { installFakeApi } from '@/test/fakeApi';

const EN = [
  { id: 28, name: 'Action' },
  { id: 18, name: 'Drama' },
];
const PT = [
  { id: 28, name: 'Ação' },
  { id: 18, name: 'Drama' },
];

describe('genres store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useGenresStore>;

  beforeEach(() => {
    api = installFakeApi();
    api.tmdb.genres.mockImplementation(async (language) => ({
      ok: true,
      data: language === 'pt-BR' ? PT : EN,
    }));
    setActivePinia(createPinia());
    store = useGenresStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('names the genres of a title in the given language', async () => {
    await store.load('en');
    await store.load('pt-BR');

    expect(store.names([28, 18], 'en')).toBe('Action, Drama');
    expect(store.names([28], 'pt-BR')).toBe('Ação');
  });

  it('skips ids it does not know', async () => {
    await store.load('en');

    expect(store.names([28, 999999], 'en')).toBe('Action');
  });

  it('answers with nothing while the names are not loaded', () => {
    expect(store.names([28], 'en')).toBe('');
    expect(store.names(undefined, 'en')).toBe('');
    expect(store.names([], 'en')).toBe('');
  });

  it('asks for each language only once, even when called together', async () => {
    await Promise.all([store.load('en'), store.load('en')]);
    await store.load('en');

    expect(api.tmdb.genres).toHaveBeenCalledTimes(1);
  });

  it('tries again after a failure', async () => {
    api.tmdb.genres.mockResolvedValueOnce({
      ok: false,
      error: { code: 'missing-credential' },
    });

    await store.load('en');
    expect(store.names([28], 'en')).toBe('');

    await store.load('en');
    expect(store.names([28], 'en')).toBe('Action');
  });

  it('does not throw when the main process cannot be reached', async () => {
    api.tmdb.genres.mockRejectedValueOnce(new Error('No handler registered'));

    await expect(store.load('en')).resolves.toBeUndefined();
    expect(store.names([28], 'en')).toBe('');
  });
});
