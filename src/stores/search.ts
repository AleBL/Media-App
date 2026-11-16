import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  Paged,
  Result,
  SearchItem,
  SearchType,
  TmdbFailure,
} from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';

export const MIN_QUERY_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 350;

export const useSearchStore = defineStore('search', () => {
  const query = ref('');
  const mediaType = ref<SearchType>('movie');
  const results = ref<SearchItem[]>([]);
  // What the results were searched as, which mediaType no longer is while
  // a search of another type is loading.
  const resultsType = ref<SearchType>('movie');
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

    const type = mediaType.value;
    let answer: Result<Paged<SearchItem>>;

    try {
      answer = await getApi().tmdb.search({
        type,
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
      resultsType.value = type;
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
    resultsType,
    totalResults,
    currentPage,
    loading,
    searched,
    error,
    search,
  };
});
