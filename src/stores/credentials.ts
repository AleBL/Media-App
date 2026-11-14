import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { CredentialStatus } from '@shared/api';
import { getApi } from '@/services/api';

// Where older versions of the app kept the key, in plain text.
const LEGACY_STORAGE_KEY = 'api_key';

/**
 * Which TMDB credential the app has: its own, a key saved by the user, or
 * none. The credentials themselves live in the main process and never come
 * to the renderer.
 */
export const useCredentialsStore = defineStore('credentials', () => {
  // false until the main process answered for the first time
  const loaded = ref(false);
  const hasKey = ref(false);
  const persisted = ref(false);
  const encrypted = ref(false);
  const builtIn = ref(false);

  function apply(status: CredentialStatus) {
    hasKey.value = status.hasKey;
    persisted.value = status.persisted;
    encrypted.value = status.encrypted;
    builtIn.value = status.builtIn;
    loaded.value = true;
  }

  /** Reads the status and clears a key left in localStorage, once. */
  async function load() {
    apply(await getApi().credentials.status());

    const legacyKey = localStorage.getItem(LEGACY_STORAGE_KEY);

    if (legacyKey === null) {
      return;
    }

    // The app searches with its own credential now, so the old key is just
    // dropped. A copy built without one still needs that key: it is handed
    // to the main process instead.
    if (legacyKey && !hasKey.value && !builtIn.value) {
      apply(await getApi().credentials.save(legacyKey));
    }

    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  /** Resolves to false when the text does not look like a TMDB key. */
  async function save(apiKey: string) {
    apply(await getApi().credentials.save(apiKey));

    return hasKey.value;
  }

  async function clear() {
    apply(await getApi().credentials.clear());
  }

  return {
    loaded,
    hasKey,
    persisted,
    encrypted,
    builtIn,
    load,
    save,
    clear,
  };
});
