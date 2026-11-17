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
import { settle } from '@/stores/account';
import { useSessionStore } from '@/stores/session';

const key = ({ type, id }: TitleRequest) => `${type}-${id}`;

/** The day of the user, as the list keeps it: YYYY-MM-DD. */
export function today(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** What the page of the watched titles shows: one page of them. */
export interface WatchedView {
  page: number;
  results: MediaItem[];
  totalResults: number;
  loading: boolean;
  /** TMDB answered at least once. */
  loaded: boolean;
  error: TmdbFailure | null;
}

const fresh = (): WatchedView => ({
  page: 1,
  results: [],
  totalResults: 0,
  loading: false,
  loaded: false,
  error: null,
});

/**
 * The titles whoever signed in watched, kept by TMDB in a list of theirs
 * (shared/tmdb/watched.ts). A mark shows at once and is undone if TMDB does
 * not take it.
 */
export const useWatchedStore = defineStore('watched', () => {
  const session = useSessionStore();
  // By title, such as "movie-603": what TMDB said, or what the user changed.
  const states = ref<Record<string, boolean>>({});
  const saving = ref<Record<string, boolean>>({});
  /**
   * Signed in without the access token of the user (before the v4 login):
   * signing in again gives it.
   */
  const needsSignIn = ref(false);
  const view = ref(fresh());
  // Incremented whenever someone else signs in, or nobody is.
  let signIns = 0;
  // Incremented on every request of a page, so an older answer is dropped.
  let latest = 0;

  watch(
    () => session.account?.id,
    () => {
      states.value = {};
      saving.value = {};
      needsSignIn.value = false;
      view.value = fresh();
      signIns += 1;
      latest += 1;
    },
  );

  function check<T>(answer: Result<T>) {
    if (!answer.ok && answer.error.code === 'signed-out') {
      void session.load();
    }

    if (!answer.ok && answer.error.code === 'sign-in-again') {
      needsSignIn.value = true;
    }

    return answer;
  }

  /** Whether the title was watched: undefined until TMDB said. */
  const stateOf = (title: TitleRequest): boolean | undefined =>
    states.value[key(title)];

  const isSaving = (title: TitleRequest) => !!saving.value[key(title)];

  async function load(title: TitleRequest) {
    const answer = check(await settle(() => getApi().watched.state(title)));

    if (answer.ok) {
      states.value[key(title)] = answer.data;
    }

    return answer;
  }

  /** Marks the title watched, today, or takes the mark away. */
  async function toggle(
    title: TitleRequest,
  ): Promise<Result<null> | undefined> {
    const current = stateOf(title);
    const at = key(title);

    if (current === undefined || saving.value[at]) {
      return undefined;
    }

    const started = signIns;

    states.value[at] = !current;
    saving.value[at] = true;

    const answer = check(
      await settle(() =>
        getApi().watched.mark({
          ...title,
          value: !current,
          date: today(),
          language: i18n.global.locale.value,
        }),
      ),
    );

    // Signed out, or someone else signed in, meanwhile: nothing to undo.
    if (started !== signIns) {
      return answer;
    }

    delete saving.value[at];

    if (!answer.ok) {
      states.value[at] = current;

      // The page only says it failed; this says how, for whoever looks
      // (nothing in it is a secret: a code and what TMDB answered).
      console.warn('The watched title could not be saved:', answer.error);
    }

    return answer;
  }

  /** A page of the watched titles. */
  async function loadPage(page = view.value.page): Promise<void> {
    const request = ++latest;
    const shown = view.value;

    shown.loading = true;
    shown.error = null;

    const answer = check(
      await settle(() =>
        getApi().watched.list({ page, language: i18n.global.locale.value }),
      ),
    );

    if (request !== latest) {
      return;
    }

    if (!answer.ok) {
      shown.loading = false;
      shown.error = answer.error;

      return;
    }

    const { results, totalResults } = answer.data;
    const last = Math.max(1, Math.ceil(totalResults / TMDB_PAGE_SIZE));

    // The last titles of the last page were taken out: the one before it.
    if (results.length === 0 && page > last) {
      return loadPage(last);
    }

    Object.assign(shown, {
      page: answer.data.page,
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
