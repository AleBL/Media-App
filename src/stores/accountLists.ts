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

/** The movies or the tv shows of a list, the pages shown so far. */
export interface ListView {
  type: MediaType;
  /** The last page shown: they all are, one after the other. */
  page: number;
  results: MediaItem[];
  totalResults: number;
  loading: boolean;
  /** TMDB answered at least once for this type. */
  loaded: boolean;
  error: TmdbFailure | null;
  /** The next page, added at the end. */
  loadingMore: boolean;
  moreFailed: boolean;
}

const emptyView = (): ListView => ({
  type: 'movie',
  page: 1,
  results: [],
  totalResults: 0,
  loading: false,
  loaded: false,
  error: null,
  loadingMore: false,
  moreFailed: false,
});

/** Each title once, as a title can move from one page to the next. */
const unique = (items: MediaItem[]) => [
  ...new Map(items.map((item) => [item.id, item])).values(),
];

const emptyViews = (): Record<TitleList, ListView> => ({
  watchlist: emptyView(),
  favorite: emptyView(),
  rated: emptyView(),
});

/**
 * Watchlist, favorites and rated titles, more pages added as the user
 * scrolls. What was shown stays while it reloads, and reloading asks for as
 * many pages again, so coming back finds the user where they were.
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

  const ask = (list: TitleList, type: MediaType, page: number) =>
    safeCall(() =>
      getApi().account.list({
        list,
        type,
        page,
        language: i18n.global.locale.value,
      }),
    );

  function failed(view: ListView, error: TmdbFailure) {
    view.loading = false;
    view.error = error;

    if (error.code === 'signed-out') {
      void session.load();
    }
  }

  /** The pages shown, asked again; the first one of another type. */
  async function load(
    list: TitleList,
    type = views.value[list].type,
  ): Promise<void> {
    const request = ++latestRequest[list];
    const view = views.value[list];

    if (type !== view.type) {
      Object.assign(view, { ...emptyView(), type });
    }

    const pages = Math.max(1, view.page);

    view.loading = true;
    view.error = null;
    view.loadingMore = false;
    view.moreFailed = false;

    const answers = await Promise.all(
      Array.from({ length: pages }, (_, index) => ask(list, type, index + 1)),
    );

    if (request !== latestRequest[list]) {
      return;
    }

    const failure = answers.find((answer) => !answer.ok);

    if (failure && !failure.ok) {
      return failed(view, failure.error);
    }

    const pagesFound = answers.flatMap((answer) =>
      answer.ok ? [answer.data] : [],
    );
    const { totalResults } = pagesFound[0];
    // Titles taken out elsewhere: fewer pages than before.
    const lastPage = Math.max(1, Math.ceil(totalResults / TMDB_PAGE_SIZE));
    const kept = pagesFound.slice(0, lastPage);

    Object.assign(view, {
      page: kept.length,
      results: unique(kept.flatMap((found) => found.results)),
      totalResults,
      loading: false,
      loaded: true,
    });
  }

  /** The page after the ones shown, at the end. */
  async function loadMore(list: TitleList): Promise<void> {
    const view = views.value[list];

    if (
      view.loading ||
      view.loadingMore ||
      view.page * TMDB_PAGE_SIZE >= view.totalResults
    ) {
      return;
    }

    const request = latestRequest[list];

    view.loadingMore = true;
    view.moreFailed = false;

    const answer = await ask(list, view.type, view.page + 1);

    if (request !== latestRequest[list]) {
      return;
    }

    view.loadingMore = false;

    if (!answer.ok) {
      view.moreFailed = true;

      if (answer.error.code === 'signed-out') {
        void session.load();
      }

      return;
    }

    Object.assign(view, {
      page: answer.data.page,
      results: unique([...view.results, ...answer.data.results]),
      totalResults: answer.data.totalResults,
    });
  }

  return { views, load, loadMore };
});
