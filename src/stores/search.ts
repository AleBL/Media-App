import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  MediaItem,
  MediaType,
  Paged,
  Result,
  TmdbFailure,
} from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';

export const MIN_QUERY_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 350;

export const useSearchStore = defineStore('search', () => {
  const query = ref('');
  const mediaType = ref<MediaType>('movie');
  const results = ref<MediaItem[]>([]);
  const totalResults = ref(0);
  const currentPage = ref(1);
  const loading = ref(false);
  // true once the current query has been answered by TMDB
  const searched = ref(false);
  const error = ref<TmdbFailure | null>(null);

  // Incremented on every call, so a slow answer to an older request can be
  // recognised and dropped instead of overwriting a newer one.
  let latestRequest = 0;

  function clearResults() {
    results.value = [];
    totalResults.value = 0;
    currentPage.value = 1;
  }

  async function search(page = 1) {
    const request = ++latestRequest;
    const text = query.value.trim();

    error.value = null;

    if (text.length < MIN_QUERY_LENGTH) {
      clearResults();
      searched.value = false;
      loading.value = false;
      return;
    }

    loading.value = true;

    let answer: Result<Paged<MediaItem>>;

    try {
      answer = await getApi().tmdb.search({
        type: mediaType.value,
        query: text,
        page,
        language: i18n.global.locale.value,
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
      results.value = answer.data.results;
      currentPage.value = answer.data.page;
      totalResults.value = answer.data.totalResults;
      searched.value = true;
    } else {
      clearResults();
      searched.value = false;
      error.value = answer.error;
    }

    loading.value = false;
  }

  return {
    query,
    mediaType,
    results,
    totalResults,
    currentPage,
    loading,
    searched,
    error,
    search,
  };
});
