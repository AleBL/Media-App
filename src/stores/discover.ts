import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  TMDB_PAGE_SIZE,
  type DiscoverFilters,
  type DiscoverFiltersRequest,
  type DiscoverRequest,
  type MediaItem,
  type Paged,
  type Result,
  type TmdbFailure,
} from '@shared/api';
import { getApi } from '@/services/api';
import { searchKey } from '@/util/media';

/** A discovery without its page: the filters, the language and the country. */
export type Discovery = Omit<DiscoverRequest, 'page'>;

const keyOf = (request: Discovery | DiscoverFiltersRequest) =>
  JSON.stringify(request);

/** A thrown error, as a failure like the others. */
const failed = (thrown: unknown) => ({
  ok: false as const,
  error: {
    code: 'server' as const,
    message: thrown instanceof Error ? thrown.message : String(thrown),
  },
});

/**
 * The titles of the Explore page, page after page, and what its filters
 * offer. The pages stay while the filters do, so coming back from a title
 * finds them where the user left.
 */
export const useDiscoverStore = defineStore('discover', () => {
  const results = ref<MediaItem[]>([]);
  const totalResults = ref(0);
  const currentPage = ref(1);
  const loading = ref(false);
  const loadingMore = ref(false);
  const moreFailed = ref(false);
  const error = ref<TmdbFailure | null>(null);
  /** The discovery the results are of, once TMDB answered it. */
  const answered = ref<string | null>(null);
  const hasMore = computed(
    () => currentPage.value * TMDB_PAGE_SIZE < totalResults.value,
  );

  let current: Discovery | null = null;
  let currentKey = '';
  // Ignores answers of an older discovery.
  let latestRequest = 0;

  function ask(request: Discovery, page: number) {
    return getApi()
      .tmdb.discover({ ...request, page })
      .catch(failed) as Promise<Result<Paged<MediaItem>>>;
  }

  /**
   * The first page of a discovery. The same one again keeps the pages
   * already there, or the one on its way.
   */
  async function discover(request: Discovery) {
    const key = keyOf(request);

    if (key === currentKey && (loading.value || answered.value === key)) {
      return;
    }

    const id = ++latestRequest;

    current = request;
    currentKey = key;
    loading.value = true;
    error.value = null;
    // A next page still on its way belongs to the discovery before.
    loadingMore.value = false;
    moreFailed.value = false;

    const answer = await ask(request, 1);

    if (id !== latestRequest) {
      return;
    }

    if (answer.ok) {
      results.value = answer.data.results;
      currentPage.value = answer.data.page;
      totalResults.value = answer.data.totalResults;
      answered.value = key;
    } else {
      results.value = [];
      currentPage.value = 1;
      totalResults.value = 0;
      answered.value = null;
      error.value = answer.error;
    }

    loading.value = false;
  }

  /** Asks for the same discovery again, after a failure. */
  function retry() {
    if (current) {
      currentKey = '';
      void discover(current);
    }
  }

  /** The page after the last one shown, at the end of the results. */
  async function loadMore() {
    if (!current || loading.value || loadingMore.value || !hasMore.value) {
      return;
    }

    const id = latestRequest;

    loadingMore.value = true;
    moreFailed.value = false;

    const answer = await ask(current, currentPage.value + 1);

    if (id !== latestRequest) {
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

  // What the filters offer, by type, language and country.
  const filters = ref<Record<string, DiscoverFilters>>({});
  const filtersFailed = ref<string[]>([]);
  const pendingFilters = new Map<string, Promise<void>>();

  /**
   * Loads what the filters of a type offer, once. A failure lets the next
   * call try again.
   */
  function loadFilters(request: DiscoverFiltersRequest): Promise<void> {
    const key = keyOf(request);

    if (filters.value[key]) {
      return Promise.resolve();
    }

    let pending = pendingFilters.get(key);

    if (!pending) {
      filtersFailed.value = filtersFailed.value.filter((one) => one !== key);
      pending = getApi()
        .tmdb.discoverFilters(request)
        .catch(failed)
        .then((answer) => {
          if (answer.ok) {
            filters.value = { ...filters.value, [key]: answer.data };
          } else {
            filtersFailed.value = [...filtersFailed.value, key];
          }
        })
        .finally(() => pendingFilters.delete(key));
      pendingFilters.set(key, pending);
    }

    return pending;
  }

  const filtersOf = (request: DiscoverFiltersRequest) =>
    filters.value[keyOf(request)] ?? null;

  const filtersFailedFor = (request: DiscoverFiltersRequest) =>
    filtersFailed.value.includes(keyOf(request));

  return {
    results,
    totalResults,
    currentPage,
    loading,
    loadingMore,
    moreFailed,
    error,
    hasMore,
    discover,
    retry,
    loadMore,
    loadFilters,
    filtersOf,
    filtersFailedFor,
  };
});
