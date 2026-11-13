import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { CredentialStatus } from '@shared/api';
import { getApi } from '@/services/api';

// Where older versions of the app kept the key, in plain text.
const LEGACY_STORAGE_KEY = 'api_key';

/**
 * Whether a TMDB key is saved. The key itself lives in the main process and
 * never comes back to the renderer.
 */
export const useCredentialsStore = defineStore('credentials', () => {
  const hasKey = ref(false);
  const persisted = ref(false);
  const encrypted = ref(false);

  function apply(status: CredentialStatus) {
    hasKey.value = status.hasKey;
    persisted.value = status.persisted;
    encrypted.value = status.encrypted;
  }

  /** Reads the status and hands over a key left in localStorage, once. */
  async function load() {
    apply(await getApi().credentials.status());

    const legacyKey = localStorage.getItem(LEGACY_STORAGE_KEY);

    if (legacyKey === null) {
      return;
    }

    if (legacyKey && !hasKey.value) {
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

  return { hasKey, persisted, encrypted, load, save, clear };
});
