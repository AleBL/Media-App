import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import {
  TMDB_PAGE_SIZE,
  type MediaItem,
  type Result,
  type TitleRequest,
  type TmdbFailure,
} from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';
import { safeCall } from '@/stores/account';
import { useSessionStore } from '@/stores/session';
import { searchKey, titleKey } from '@/util/media';

/** The user's local day, YYYY-MM-DD. */
export function today(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export interface WatchedView {
  /** The last page shown: they all are, one after the other. */
  page: number;
  results: MediaItem[];
  totalResults: number;
  loading: boolean;
  /** TMDB answered at least once. */
  loaded: boolean;
  error: TmdbFailure | null;
  /** The next page, added at the end. */
  loadingMore: boolean;
  moreFailed: boolean;
}

const emptyView = (): WatchedView => ({
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
  ...new Map(items.map((item) => [searchKey(item), item])).values(),
];

/**
 * The watched titles (shared/tmdb/watched.ts). A mark shows at once and is
 * undone if TMDB refuses it.
 */
export const useWatchedStore = defineStore('watched', () => {
  const session = useSessionStore();
  // By title key: what TMDB said or the user changed.
  const states = ref<Record<string, boolean>>({});
  const saving = ref<Record<string, boolean>>({});
  /** Signed in without the v4 access token: signing in again gives it. */
  const needsSignIn = ref(false);
  const view = ref(emptyView());
  // Changes on every sign-in or sign-out, so late answers are ignored.
  let sessionVersion = 0;
  // Ignores answers of an older page request.
  let latestRequest = 0;

  watch(
    () => session.account?.id,
    () => {
      states.value = {};
      saving.value = {};
      needsSignIn.value = false;
      view.value = emptyView();
      sessionVersion += 1;
      latestRequest += 1;
    },
  );

  function handleFailure<T>(result: Result<T>) {
    if (!result.ok && result.error.code === 'signed-out') {
      void session.load();
    }

    if (!result.ok && result.error.code === 'sign-in-again') {
      needsSignIn.value = true;
    }

    return result;
  }

  /** Undefined until TMDB answered. */
  const stateOf = (title: TitleRequest): boolean | undefined =>
    states.value[titleKey(title)];

  const isSaving = (title: TitleRequest) => !!saving.value[titleKey(title)];

  async function load(title: TitleRequest) {
    const result = handleFailure(
      await safeCall(() => getApi().watched.state(title)),
    );

    if (result.ok) {
      states.value[titleKey(title)] = result.data;
    }

    return result;
  }

  /** Marks the title watched today, or removes the mark. */
  async function toggle(
    title: TitleRequest,
  ): Promise<Result<null> | undefined> {
    const current = stateOf(title);
    const key = titleKey(title);

    if (current === undefined || saving.value[key]) {
      return undefined;
    }

    const version = sessionVersion;

    states.value[key] = !current;
    saving.value[key] = true;

    const result = handleFailure(
      await safeCall(() =>
        getApi().watched.mark({
          ...title,
          value: !current,
          date: today(),
          language: i18n.global.locale.value,
        }),
      ),
    );

    // Signed out or another user meanwhile: nothing to undo.
    if (version !== sessionVersion) {
      return result;
    }

    delete saving.value[key];

    if (!result.ok) {
      states.value[key] = current;

      // The page only says it failed; the console says why (no secrets).
      console.warn('The watched title could not be saved:', result.error);
    }

    return result;
  }

  const ask = (page: number) =>
    safeCall(() =>
      getApi().watched.list({ page, language: i18n.global.locale.value }),
    ).then(handleFailure);

  /** The pages shown, asked again, so coming back finds them all. */
  async function loadPage(): Promise<void> {
    const request = ++latestRequest;
    const current = view.value;
    const pages = Math.max(1, current.page);

    current.loading = true;
    current.error = null;
    current.loadingMore = false;
    current.moreFailed = false;

    const answers = await Promise.all(
      Array.from({ length: pages }, (_, index) => ask(index + 1)),
    );

    if (request !== latestRequest) {
      return;
    }

    const failure = answers.find((answer) => !answer.ok);

    if (failure && !failure.ok) {
      current.loading = false;
      current.error = failure.error;

      return;
    }

    const found = answers.flatMap((answer) => (answer.ok ? [answer.data] : []));
    const { totalResults } = found[0];
    // Titles unmarked elsewhere: fewer pages than before.
    const lastPage = Math.max(1, Math.ceil(totalResults / TMDB_PAGE_SIZE));
    const kept = found.slice(0, lastPage);

    Object.assign(current, {
      page: kept.length,
      results: unique(kept.flatMap((answer) => answer.results)),
      totalResults,
      loading: false,
      loaded: true,
    });
  }

  /** The page after the ones shown, at the end. */
  async function loadMore(): Promise<void> {
    const current = view.value;

    if (
      current.loading ||
      current.loadingMore ||
      current.page * TMDB_PAGE_SIZE >= current.totalResults
    ) {
      return;
    }

    const request = latestRequest;

    current.loadingMore = true;
    current.moreFailed = false;

    const answer = await ask(current.page + 1);

    if (request !== latestRequest) {
      return;
    }

    current.loadingMore = false;

    if (!answer.ok) {
      current.moreFailed = true;

      return;
    }

    Object.assign(current, {
      page: answer.data.page,
      results: unique([...current.results, ...answer.data.results]),
      totalResults: answer.data.totalResults,
    });
  }

  return {
    states,
    needsSignIn,
    view,
    stateOf,
    isSaving,
    load,
    toggle,
    loadPage,
    loadMore,
  };
});
