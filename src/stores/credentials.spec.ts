import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCredentialsStore } from '@/stores/credentials';
import { installFakeApi, NO_KEY, SAVED_KEY } from '@/test/fakeApi';

const KEY = '0123456789abcdef0123456789abcdef';

describe('credentials store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useCredentialsStore>;

  beforeEach(() => {
    localStorage.clear();
    api = installFakeApi();
    setActivePinia(createPinia());
    store = useCredentialsStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('reads the status kept by the main process', async () => {
    api.credentials.status.mockResolvedValue(SAVED_KEY);

    await store.load();

    expect(store.hasKey).toBe(true);
    expect(store.persisted).toBe(true);
    expect(api.credentials.save).not.toHaveBeenCalled();
  });

  it('hands a key left in localStorage to the main process and deletes it', async () => {
    localStorage.setItem('api_key', KEY);

    await store.load();

    expect(api.credentials.save).toHaveBeenCalledWith(KEY);
    expect(localStorage.getItem('api_key')).toBeNull();
    expect(store.hasKey).toBe(true);
  });

  it('does not replace a saved key with the one in localStorage', async () => {
    api.credentials.status.mockResolvedValue(SAVED_KEY);
    localStorage.setItem('api_key', KEY);

    await store.load();

    expect(api.credentials.save).not.toHaveBeenCalled();
    expect(localStorage.getItem('api_key')).toBeNull();
  });

  it('just removes an empty entry left in localStorage', async () => {
    localStorage.setItem('api_key', '');

    await store.load();

    expect(api.credentials.save).not.toHaveBeenCalled();
    expect(localStorage.getItem('api_key')).toBeNull();
    expect(store.hasKey).toBe(false);
  });

  it('saves a key and reports that it was accepted', async () => {
    await expect(store.save(KEY)).resolves.toBe(true);

    expect(api.credentials.save).toHaveBeenCalledWith(KEY);
    expect(store.hasKey).toBe(true);
  });

  it('reports a key that the main process refused', async () => {
    api.credentials.save.mockResolvedValue(NO_KEY);

    await expect(store.save('nope')).resolves.toBe(false);
    expect(store.hasKey).toBe(false);
  });

  it('tells when the key is kept for this session only', async () => {
    api.credentials.save.mockResolvedValue({
      hasKey: true,
      persisted: false,
      encrypted: false,
    });

    await store.save(KEY);

    expect(store.hasKey).toBe(true);
    expect(store.persisted).toBe(false);
  });

  it('tells when the saved key is not encrypted', async () => {
    api.credentials.status.mockResolvedValue({
      hasKey: true,
      persisted: true,
      encrypted: false,
    });

    await store.load();

    expect(store.persisted).toBe(true);
    expect(store.encrypted).toBe(false);
  });

  it('removes the key', async () => {
    await store.save(KEY);
    await store.clear();

    expect(api.credentials.clear).toHaveBeenCalled();
    expect(store.hasKey).toBe(false);
  });
});
