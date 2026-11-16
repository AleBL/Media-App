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

/**
 * How many pages of 20 the app reads of each list for the cards. Past
 * them, a card takes a title for not being in the list; its page asks TMDB
 * about it alone and knows.
 */
export const MAX_LIST_PAGES = 10;

const key = ({ type, id }: TitleRequest) => `${type}-${id}`;

/** What a call that threw answers instead: a failure like any other. */
export async function settle<T>(
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
 * Whether titles are in the watchlist and in the favorites of whoever signed
 * in, the ratings they gave, and the changes to them. A change shows at once
 * and is undone if TMDB does not take it.
 */
export const useAccountStore = defineStore('account', () => {
  const session = useSessionStore();
  // By title, such as "movie-603": what TMDB said of that title, or what
  // the user changed. It wins over `lists`.
  const states = ref<Record<string, AccountStates>>({});
  // Every title in each list, read at once for the cards; null until then.
  const lists = ref<Record<AccountList, Set<string>> | null>(null);
  // The changes on their way, such as "watchlist:movie-603".
  const saving = ref<Record<string, boolean>>({});
  // By title: its rating, null for none, as TMDB said on the page of the
  // title or as the user changed it. Only the pages of titles read them.
  const ratings = ref<Record<string, number | null>>({});
  // The titles whose rating is on its way to TMDB.
  let rating: Record<string, true> = {};
  // Incremented on every reading of the lists, so an older one is dropped.
  let reading = 0;
  // Incremented whenever someone else signs in, or nobody is, so what was
  // on its way for the one before does not touch what is known now.
  let signIns = 0;

  /**
   * Reads which titles are in the lists, page by page up to MAX_LIST_PAGES
   * for each of the four (movies and tv shows of each list). TMDB tells this
   * one title at a time otherwise, too many requests for a page of cards.
   */
  async function loadLists() {
    const request = ++reading;
    const found: Record<AccountList, Set<string>> = {
      watchlist: new Set(),
      favorite: new Set(),
    };

    async function read(list: AccountList, type: MediaType) {
      for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
        const answer = check(
          await settle(() =>
            getApi().account.list({
              list,
              type,
              page,
              language: i18n.global.locale.value,
            }),
          ),
        );

        if (!answer.ok) {
          return false;
        }

        for (const { id } of answer.data.results) {
          found[list].add(key({ type, id }));
        }

        if (page >= answer.data.totalPages) {
          return true;
        }
      }

      return true;
    }

    const done = await Promise.all([
      read('watchlist', 'movie'),
      read('watchlist', 'tv'),
      read('favorite', 'movie'),
      read('favorite', 'tv'),
    ]);

    // Without all four, the cards could say a title is not in a list it
    // is in: they show no buttons instead.
    if (request === reading) {
      lists.value = done.every(Boolean) ? found : null;
    }
  }

  // Someone else signed in, or nobody is: what was known no longer holds.
  watch(
    () => session.account?.id,
    (signedIn) => {
      states.value = {};
      saving.value = {};
      lists.value = null;
      ratings.value = {};
      rating = {};
      reading += 1;
      signIns += 1;

      if (signedIn !== undefined) {
        void loadLists();
      }
    },
    { immediate: true },
  );

  /** TMDB says nobody is signed in: the app learns it too. */
  function check<T>(answer: Result<T>) {
    if (!answer.ok && answer.error.code === 'signed-out') {
      void session.load();
    }

    return answer;
  }

  /** Where a title is, if the app knows: by itself, or from the lists. */
  function statesOf(title: TitleRequest): AccountStates | undefined {
    const known = states.value[key(title)];

    if (known || !lists.value) {
      return known;
    }

    return {
      watchlist: lists.value.watchlist.has(key(title)),
      favorite: lists.value.favorite.has(key(title)),
    };
  }

  const isSaving = (list: AccountList, title: TitleRequest) =>
    !!saving.value[`${list}:${key(title)}`];

  /** The rating of a title: undefined until TMDB said, null for none. */
  const ratingOf = (title: TitleRequest): number | null | undefined =>
    ratings.value[key(title)];

  async function load(title: TitleRequest) {
    const answer = check(await settle(() => getApi().account.states(title)));

    if (answer.ok) {
      const { rated, ...inLists } = answer.data;

      states.value[key(title)] = inLists;

      // A rating on its way wins over what TMDB had before it.
      if (!rating[key(title)]) {
        ratings.value[key(title)] = rated;
      }
    }

    return answer;
  }

  /**
   * Asks TMDB again which lists a title is in, and keeps what it says,
   * except for a change of a list that is on its way.
   */
  async function relist(title: TitleRequest) {
    const started = signIns;
    const answer = check(await settle(() => getApi().account.states(title)));
    const now = statesOf(title);

    if (!answer.ok || started !== signIns || !now) {
      return;
    }

    states.value[key(title)] = {
      watchlist: isSaving('watchlist', title)
        ? now.watchlist
        : answer.data.watchlist,
      favorite: isSaving('favorite', title)
        ? now.favorite
        : answer.data.favorite,
    };
  }

  /**
   * Gives the title a rating, or takes it away (`null`), at once. A change
   * made while another is on its way goes after it, only the last one, so
   * TMDB ends with what the page shows. If TMDB refuses, the page goes back
   * to the rating TMDB has.
   */
  async function rate(
    title: TitleRequest,
    value: number | null,
  ): Promise<Result<null> | undefined> {
    const at = key(title);
    const before: number | null | undefined = ratings.value[at];

    // Nothing to change before TMDB said what the rating is.
    if (before === undefined) {
      return undefined;
    }

    ratings.value[at] = value;

    // The change on its way sends this one when it is done.
    if (rating[at]) {
      return undefined;
    }

    const started = signIns;
    let atTmdb = before;
    let answer: Result<null> = { ok: true, data: null };
    // TMDB took a rating (not a removal) of the title.
    let rated = false;

    rating[at] = true;

    while (ratings.value[at] !== atTmdb) {
      const wanted = ratings.value[at];

      answer = check(
        await settle(() => getApi().account.rate({ ...title, value: wanted })),
      );

      // Signed out, or someone else signed in, meanwhile: nothing to undo.
      if (started !== signIns) {
        return answer;
      }

      if (!answer.ok) {
        ratings.value[at] = atTmdb;
        break;
      }

      atTmdb = wanted;
      rated ||= wanted !== null;
    }

    delete rating[at];

    // By default TMDB takes a title it rates out of the watchlist: the
    // lists of the title are asked again.
    if (rated) {
      await relist(title);
    }

    return answer;
  }

  /** Puts the title in the list, or takes it out: the opposite of now. */
  async function toggle(
    list: AccountList,
    title: TitleRequest,
  ): Promise<Result<null> | undefined> {
    const current = statesOf(title);
    const change = `${list}:${key(title)}`;

    // Nothing to flip before TMDB said where it is, and one change at once.
    if (!current || saving.value[change]) {
      return undefined;
    }

    const value = !current[list];
    const account = session.account?.id;

    states.value[key(title)] = { ...current, [list]: value };
    saving.value[change] = true;

    const answer = check(
      await settle(() => getApi().account.mark({ ...title, list, value })),
    );

    // Signed out, or someone else signed in, meanwhile: nothing to undo.
    if (session.account?.id !== account) {
      return answer;
    }

    delete saving.value[change];

    const now = statesOf(title);

    if (!answer.ok && now) {
      states.value[key(title)] = { ...now, [list]: !value };
    }

    return answer;
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
