import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MediaItem, MediaList, Result, TmdbFailure } from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';

/** The lists of the home page, in the order it shows them. */
export const HOME_LISTS: readonly MediaList[] = [
  'trending',
  'popular-movies',
  'popular-tv',
];

export interface ListState {
  items: MediaItem[];
  /** The language the items are in, once they arrived. */
  language: string | null;
  loading: boolean;
  error: TmdbFailure | null;
}

const empty = (): ListState => ({
  items: [],
  language: null,
  loading: false,
  error: null,
});

/** The lists of titles of the home page, loaded from TMDB. */
export const useHomeStore = defineStore('home', () => {
  const lists = ref(
    Object.fromEntries(HOME_LISTS.map((list) => [list, empty()])) as Record<
      MediaList,
      ListState
    >,
  );

  // One counter per list, so a slow answer in the language left behind is
  // dropped instead of replacing the one asked for after it.
  const latest = new Map<MediaList, number>();

  async function loadList(list: MediaList) {
    const request = (latest.get(list) ?? 0) + 1;
    const language = i18n.global.locale.value;
    const state = lists.value[list];

    latest.set(list, request);
    state.loading = true;
    state.error = null;

    let answer: Result<MediaItem[]>;

    try {
      answer = await getApi().tmdb.list({ list, language });
    } catch (thrown) {
      answer = {
        ok: false,
        error: {
          code: 'server',
          message: thrown instanceof Error ? thrown.message : String(thrown),
        },
      };
    }

    if (request !== latest.get(list)) {
      return;
    }

    if (answer.ok) {
      state.items = answer.data;
      state.language = language;
    } else {
      state.items = [];
      state.language = null;
      state.error = answer.error;
    }

    state.loading = false;
  }

  /**
   * Loads the lists that are not there yet in the language of the app.
   * Coming back to the home page shows the ones already loaded at once.
   */
  function load() {
    const language = i18n.global.locale.value;

    return Promise.all(
      HOME_LISTS.filter((list) => lists.value[list].language !== language).map(
        loadList,
      ),
    );
  }

  return { lists, load, loadList };
});
