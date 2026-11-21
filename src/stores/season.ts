import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Result, SeasonDetails, TmdbFailure } from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';

/** The season being shown, with its episodes. */
export const useSeasonStore = defineStore('season', () => {
  const season = ref<SeasonDetails | null>(null);
  const loading = ref(false);
  const error = ref<TmdbFailure | null>(null);

  // Ignores answers of an older request.
  let latestRequest = 0;

  async function load(id: number, number: number) {
    const request = ++latestRequest;
    const language = i18n.global.locale.value;

    error.value = null;
    loading.value = true;

    // Another season: what is on the screen is not about it. The same one
    // stays while it is asked for again, in another language.
    if (season.value?.showId !== id || season.value.number !== number) {
      season.value = null;
    }

    let answer: Result<SeasonDetails>;

    try {
      answer = await getApi().tmdb.season({ id, season: number, language });
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
      season.value = answer.data;
    } else {
      season.value = null;
      error.value = answer.error;
    }

    loading.value = false;
  }

  return { season, loading, error, load };
});
