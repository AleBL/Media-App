import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MediaDetails, MediaType, Result, TmdbFailure } from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';
import { userRegion } from '@/util/region';

/** The page of the movie or tv show being shown. */
export const useDetailsStore = defineStore('details', () => {
  const details = ref<MediaDetails | null>(null);
  /** The country that where to watch is about. */
  const region = ref('');
  const loading = ref(false);
  const error = ref<TmdbFailure | null>(null);

  // Incremented on every call, so a slow answer about the title shown before
  // is dropped instead of replacing the one asked for after it.
  let latestRequest = 0;

  async function load(type: MediaType, id: number) {
    const request = ++latestRequest;
    const language = i18n.global.locale.value;

    error.value = null;
    loading.value = true;
    region.value = userRegion(language);

    // Another title: what is on the screen is not about it. The same title
    // stays while it is asked for again, in another language.
    if (details.value?.type !== type || details.value.id !== id) {
      details.value = null;
    }

    let answer: Result<MediaDetails>;

    try {
      answer = await getApi().tmdb.details({
        type,
        id,
        language,
        region: region.value,
      });
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
      details.value = answer.data;
    } else {
      details.value = null;
      error.value = answer.error;
    }

    loading.value = false;
  }

  return { details, region, loading, error, load };
});
