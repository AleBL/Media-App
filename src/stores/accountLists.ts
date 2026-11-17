import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import {
  TMDB_PAGE_SIZE,
  type MediaItem,
  type MediaType,
  type TitleList,
  type TmdbFailure,
} from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';
import { safeCall } from '@/stores/account';
import { useSessionStore } from '@/stores/session';

/** One page of the movies or of the tv shows of a list. */
export interface ListView {
  type: MediaType;
  page: number;
  results: MediaItem[];
  totalResults: number;
  loading: boolean;
  /** TMDB answered at least once for this type. */
  loaded: boolean;
  error: TmdbFailure | null;
}

const emptyView = (): ListView => ({
  type: 'movie',
  page: 1,
  results: [],
  totalResults: 0,
  loading: false,
  loaded: false,
  error: null,
});

const emptyViews = (): Record<TitleList, ListView> => ({
  watchlist: emptyView(),
  favorite: emptyView(),
  rated: emptyView(),
});

/**
 * Watchlist, favorites and rated titles, a page at a time. The page shown
 * stays while it reloads, so coming back finds it where it was.
 */
export const useAccountListsStore = defineStore('accountLists', () => {
  const session = useSessionStore();
  const views = ref(emptyViews());
  // Ignores answers of an older request of each list.
  const latestRequest: Record<TitleList, number> = {
    watchlist: 0,
    favorite: 0,
    rated: 0,
  };

  watch(
    () => session.account?.id,
    () => {
      views.value = emptyViews();
      latestRequest.watchlist += 1;
      latestRequest.favorite += 1;
      latestRequest.rated += 1;
    },
  );

  async function load(
    list: TitleList,
    page = views.value[list].page,
    type = views.value[list].type,
  ): Promise<void> {
    const request = ++latestRequest[list];
    const view = views.value[list];

    if (type !== view.type) {
      Object.assign(view, { ...emptyView(), type });
    }

    view.loading = true;
    view.error = null;

    const result = await safeCall(() =>
      getApi().account.list({
        list,
        type,
        page,
        language: i18n.global.locale.value,
      }),
    );

    if (request !== latestRequest[list]) {
      return;
    }

    if (!result.ok) {
      view.loading = false;
      view.error = result.error;

      if (result.error.code === 'signed-out') {
        void session.load();
      }

      return;
    }

    const { results, totalResults } = result.data;
    const lastPage = Math.max(1, Math.ceil(totalResults / TMDB_PAGE_SIZE));

    // The last titles of the last page were removed: show the one before.
    if (results.length === 0 && page > lastPage) {
      return load(list, lastPage, type);
    }

    Object.assign(view, {
      page: result.data.page,
      results,
      totalResults,
      loading: false,
      loaded: true,
    });
  }

  return { views, load };
});
