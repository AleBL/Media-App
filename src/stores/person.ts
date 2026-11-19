import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { PersonDetails, Result, TmdbFailure } from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';

/** The page of the person being shown. */
export const usePersonStore = defineStore('person', () => {
  const person = ref<PersonDetails | null>(null);
  const loading = ref(false);
  const error = ref<TmdbFailure | null>(null);

  // Ignores answers of an older request.
  let latestRequest = 0;

  async function load(id: number) {
    const request = ++latestRequest;
    const language = i18n.global.locale.value;

    error.value = null;
    loading.value = true;

    // Someone else: what is on the screen is not about them. The same
    // person stays while they are asked for again, in another language.
    if (person.value?.id !== id) {
      person.value = null;
    }

    let answer: Result<PersonDetails>;

    try {
      answer = await getApi().tmdb.person({ id, language });
    } catch (thrown) {
      answer = {
        ok: false,
        error: {
          code: 'server',
          message: thrown instanceof Error ? thrown.message : String(thrown),
        },
      };
    }

    if (request !== latestRequest) {
      return;
    }

    if (answer.ok) {
      person.value = answer.data;
    } else {
      person.value = null;
      error.value = answer.error;
    }

    loading.value = false;
  }

  return { person, loading, error, load };
});
