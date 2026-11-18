import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  TMDB_PAGE_SIZE,
  type Paged,
  type Result,
  type SearchItem,
  type SearchType,
  type TmdbFailure,
} from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';
import { searchKey } from '@/util/media';

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

  // The next page, added at the end of the results.
  const loadingMore = ref(false);
  const moreFailed = ref(false);
  const hasMore = computed(
    () => currentPage.value * TMDB_PAGE_SIZE < totalResults.value,
  );

  // Ignores answers of an older request.
  let latestRequest = 0;

  function clearResults() {
    results.value = [];
    totalResults.value = 0;
    currentPage.value = 1;
    loadingMore.value = false;
    moreFailed.value = false;
  }

  function ask(page: number): Promise<Result<Paged<SearchItem>>> {
    return getApi()
      .tmdb.search({
        type: mediaType.value,
        query: query.value.trim(),
        page,
        language: i18n.global.locale.value,
      })
      .catch((thrown: unknown) => ({
        ok: false as const,
        error: {
          code: 'server' as const,
          message: thrown instanceof Error ? thrown.message : String(thrown),
        },
      }));
  }

  /**
   * The page after the last one shown, at the end of the results. A new
   * search meanwhile wins: the answer is dropped.
   */
  async function loadMore() {
    if (loading.value || loadingMore.value || !hasMore.value) {
      return;
    }

    const request = latestRequest;

    loadingMore.value = true;
    moreFailed.value = false;

    const answer = await ask(currentPage.value + 1);

    if (request !== latestRequest) {
      return;
    }

    loadingMore.value = false;

    if (!answer.ok) {
      moreFailed.value = true;
      return;
    }

    // A title that moved between pages while scrolling shows once.
    const shown = new Set(results.value.map(searchKey));

    results.value = [
      ...results.value,
      ...answer.data.results.filter((item) => !shown.has(searchKey(item))),
    ];
    currentPage.value = answer.data.page;
    totalResults.value = answer.data.totalResults;
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
    // A next page still on its way belongs to the search before.
    loadingMore.value = false;
    moreFailed.value = false;

    const type = mediaType.value;
    const answer = await ask(page);

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
    loadingMore,
    moreFailed,
    hasMore,
    search,
    loadMore,
  };
});
