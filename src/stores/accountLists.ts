import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import {
  TMDB_PAGE_SIZE,
  type AccountList,
  type MediaItem,
  type MediaType,
  type TmdbFailure,
} from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';
import { settle } from '@/stores/account';
import { useSessionStore } from '@/stores/session';

/** What the page of a list shows: one page of its movies or of its shows. */
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

const fresh = (): ListView => ({
  type: 'movie',
  page: 1,
  results: [],
  totalResults: 0,
  loading: false,
  loaded: false,
  error: null,
});

/**
 * The watchlist and the favorites of whoever signed in, a page at a time.
 * What was shown stays while the page is asked again, so coming back to a
 * list finds it where it was.
 */
export const useAccountListsStore = defineStore('accountLists', () => {
  const session = useSessionStore();
  const views = ref<Record<AccountList, ListView>>({
    watchlist: fresh(),
    favorite: fresh(),
  });
  // Incremented on every request, so an older answer can be dropped.
  const latest: Record<AccountList, number> = { watchlist: 0, favorite: 0 };

  // Someone else signed in, or nobody is: nothing shown holds anymore.
  watch(
    () => session.account?.id,
    () => {
      views.value = { watchlist: fresh(), favorite: fresh() };
      latest.watchlist += 1;
      latest.favorite += 1;
    },
  );

  /** A page of the movies or of the tv shows of a list. */
  async function load(
    list: AccountList,
    page = views.value[list].page,
    type = views.value[list].type,
  ): Promise<void> {
    const request = ++latest[list];
    const view = views.value[list];

    // Nothing of the other type stays on screen.
    if (type !== view.type) {
      Object.assign(view, { ...fresh(), type });
    }

    view.loading = true;
    view.error = null;

    const answer = await settle(() =>
      getApi().account.list({
        list,
        type,
        page,
        language: i18n.global.locale.value,
      }),
    );

    if (request !== latest[list]) {
      return;
    }

    if (!answer.ok) {
      view.loading = false;
      view.error = answer.error;

      if (answer.error.code === 'signed-out') {
        void session.load();
      }

      return;
    }

    const { results, totalResults } = answer.data;
    const last = Math.max(1, Math.ceil(totalResults / TMDB_PAGE_SIZE));

    // The last titles of the last page were taken out: the one before it.
    if (results.length === 0 && page > last) {
      return load(list, last, type);
    }

    Object.assign(view, {
      page: answer.data.page,
      results,
      totalResults,
      loading: false,
      loaded: true,
    });
  }

  return { views, load };
});
