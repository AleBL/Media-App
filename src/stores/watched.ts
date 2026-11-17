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
import { titleKey } from '@/util/media';

/** The user's local day, YYYY-MM-DD. */
export function today(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export interface WatchedView {
  page: number;
  results: MediaItem[];
  totalResults: number;
  loading: boolean;
  /** TMDB answered at least once. */
  loaded: boolean;
  error: TmdbFailure | null;
}

const emptyView = (): WatchedView => ({
  page: 1,
  results: [],
  totalResults: 0,
  loading: false,
  loaded: false,
  error: null,
});

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

  async function loadPage(page = view.value.page): Promise<void> {
    const request = ++latestRequest;
    const current = view.value;

    current.loading = true;
    current.error = null;

    const result = handleFailure(
      await safeCall(() =>
        getApi().watched.list({ page, language: i18n.global.locale.value }),
      ),
    );

    if (request !== latestRequest) {
      return;
    }

    if (!result.ok) {
      current.loading = false;
      current.error = result.error;

      return;
    }

    const { results, totalResults } = result.data;
    const lastPage = Math.max(1, Math.ceil(totalResults / TMDB_PAGE_SIZE));

    // The last titles of the last page were removed: show the one before.
    if (results.length === 0 && page > lastPage) {
      return loadPage(lastPage);
    }

    Object.assign(current, {
      page: result.data.page,
      results,
      totalResults,
      loading: false,
      loaded: true,
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
  };
});
