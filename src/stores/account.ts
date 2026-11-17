import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type {
  AccountList,
  AccountStates,
  MediaType,
  Result,
  TitleRequest,
} from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';
import { useSessionStore } from '@/stores/session';
import { titleKey } from '@/util/media';

/**
 * Pages of 20 read from each list for the card buttons. Past them a card
 * assumes the title is not in the list; the title page asks for it alone.
 */
export const MAX_LIST_PAGES = 10;

/** Turns a thrown error into a failed Result. */
export async function safeCall<T>(
  call: () => Promise<Result<T>>,
): Promise<Result<T>> {
  try {
    return await call();
  } catch (thrown) {
    return {
      ok: false,
      error: {
        code: 'server',
        message: thrown instanceof Error ? thrown.message : String(thrown),
      },
    };
  }
}

/**
 * Watchlist, favorites and ratings of the signed-in user. Changes show at
 * once and are undone if TMDB refuses them.
 */
export const useAccountStore = defineStore('account', () => {
  const session = useSessionStore();
  // By title key: what TMDB said or the user changed. Wins over `lists`.
  const states = ref<Record<string, AccountStates>>({});
  // Every title of each list, for the cards; null until loaded.
  const lists = ref<Record<AccountList, Set<string>> | null>(null);
  // Changes in flight, such as "watchlist:movie-603".
  const saving = ref<Record<string, boolean>>({});
  // By title key: the rating, null for none. Only title pages load them.
  const ratings = ref<Record<string, number | null>>({});
  let ratingsInFlight: Record<string, true> = {};
  // Ignores answers of an older load of the lists.
  let listsRequest = 0;
  // Changes on every sign-in or sign-out, so late answers are ignored.
  let sessionVersion = 0;

  /**
   * Reads which titles are in the lists, up to MAX_LIST_PAGES of each
   * (movies and tv shows of each list). Otherwise TMDB answers one title at
   * a time, too many requests for a page of cards.
   */
  async function loadLists() {
    const request = ++listsRequest;
    const found: Record<AccountList, Set<string>> = {
      watchlist: new Set(),
      favorite: new Set(),
    };

    async function readList(list: AccountList, type: MediaType) {
      for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
        const result = handleSignedOut(
          await safeCall(() =>
            getApi().account.list({
              list,
              type,
              page,
              language: i18n.global.locale.value,
            }),
          ),
        );

        if (!result.ok) {
          return false;
        }

        for (const { id } of result.data.results) {
          found[list].add(titleKey({ type, id }));
        }

        if (page >= result.data.totalPages) {
          return true;
        }
      }

      return true;
    }

    const complete = await Promise.all([
      readList('watchlist', 'movie'),
      readList('watchlist', 'tv'),
      readList('favorite', 'movie'),
      readList('favorite', 'tv'),
    ]);

    // With a list missing, the cards could be wrong: they show no buttons.
    if (request === listsRequest) {
      lists.value = complete.every(Boolean) ? found : null;
    }
  }

  watch(
    () => session.account?.id,
    (accountId) => {
      states.value = {};
      saving.value = {};
      lists.value = null;
      ratings.value = {};
      ratingsInFlight = {};
      listsRequest += 1;
      sessionVersion += 1;

      if (accountId !== undefined) {
        void loadLists();
      }
    },
    { immediate: true },
  );

  /** Reloads the session when TMDB says nobody is signed in. */
  function handleSignedOut<T>(result: Result<T>) {
    if (!result.ok && result.error.code === 'signed-out') {
      void session.load();
    }

    return result;
  }

  /** Undefined while unknown. */
  function statesOf(title: TitleRequest): AccountStates | undefined {
    const known = states.value[titleKey(title)];

    if (known || !lists.value) {
      return known;
    }

    return {
      watchlist: lists.value.watchlist.has(titleKey(title)),
      favorite: lists.value.favorite.has(titleKey(title)),
    };
  }

  const isSaving = (list: AccountList, title: TitleRequest) =>
    !!saving.value[`${list}:${titleKey(title)}`];

  /** Undefined until TMDB answered, null for no rating. */
  const ratingOf = (title: TitleRequest): number | null | undefined =>
    ratings.value[titleKey(title)];

  async function load(title: TitleRequest) {
    const result = handleSignedOut(
      await safeCall(() => getApi().account.states(title)),
    );

    if (result.ok) {
      const { rated, ...inLists } = result.data;

      states.value[titleKey(title)] = inLists;

      // A rating in flight wins over the older one from TMDB.
      if (!ratingsInFlight[titleKey(title)]) {
        ratings.value[titleKey(title)] = rated;
      }
    }

    return result;
  }

  /** Reloads which lists a title is in, keeping changes in flight. */
  async function refreshListStates(title: TitleRequest) {
    const version = sessionVersion;
    const result = handleSignedOut(
      await safeCall(() => getApi().account.states(title)),
    );
    const current = statesOf(title);

    if (!result.ok || version !== sessionVersion || !current) {
      return;
    }

    states.value[titleKey(title)] = {
      watchlist: isSaving('watchlist', title)
        ? current.watchlist
        : result.data.watchlist,
      favorite: isSaving('favorite', title)
        ? current.favorite
        : result.data.favorite,
    };
  }

  /**
   * Sets the rating (null removes it) at once. Changes made while one is in
   * flight are sent after it, only the last one. If TMDB refuses, the
   * rating goes back to what TMDB has.
   */
  async function rate(
    title: TitleRequest,
    value: number | null,
  ): Promise<Result<null> | undefined> {
    const key = titleKey(title);
    const before: number | null | undefined = ratings.value[key];

    // Not loaded yet.
    if (before === undefined) {
      return undefined;
    }

    ratings.value[key] = value;

    // The request in flight sends this value when it is done.
    if (ratingsInFlight[key]) {
      return undefined;
    }

    const version = sessionVersion;
    let savedRating = before;
    let result: Result<null> = { ok: true, data: null };
    let ratedAtLeastOnce = false;

    ratingsInFlight[key] = true;

    while (ratings.value[key] !== savedRating) {
      const wanted = ratings.value[key];

      result = handleSignedOut(
        await safeCall(() =>
          getApi().account.rate({ ...title, value: wanted }),
        ),
      );

      // Signed out or another user meanwhile: nothing to undo.
      if (version !== sessionVersion) {
        return result;
      }

      if (!result.ok) {
        ratings.value[key] = savedRating;
        break;
      }

      savedRating = wanted;
      ratedAtLeastOnce ||= wanted !== null;
    }

    delete ratingsInFlight[key];

    // TMDB takes a rated title out of the watchlist.
    if (ratedAtLeastOnce) {
      await refreshListStates(title);
    }

    return result;
  }

  /** Adds the title to the list, or removes it. */
  async function toggle(
    list: AccountList,
    title: TitleRequest,
  ): Promise<Result<null> | undefined> {
    const current = statesOf(title);
    const change = `${list}:${titleKey(title)}`;

    // Not loaded yet, or a change already in flight.
    if (!current || saving.value[change]) {
      return undefined;
    }

    const value = !current[list];
    const accountId = session.account?.id;

    states.value[titleKey(title)] = { ...current, [list]: value };
    saving.value[change] = true;

    const result = handleSignedOut(
      await safeCall(() => getApi().account.mark({ ...title, list, value })),
    );

    // Signed out or another user meanwhile: nothing to undo.
    if (session.account?.id !== accountId) {
      return result;
    }

    delete saving.value[change];

    const now = statesOf(title);

    if (!result.ok && now) {
      states.value[titleKey(title)] = { ...now, [list]: !value };
    }

    return result;
  }

  return {
    states,
    lists,
    ratings,
    statesOf,
    ratingOf,
    isSaving,
    load,
    loadLists,
    toggle,
    rate,
  };
});
