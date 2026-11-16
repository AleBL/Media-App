import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type {
  AccountList,
  AccountStates,
  Result,
  TitleRequest,
} from '@shared/api';
import { getApi } from '@/services/api';
import { useSessionStore } from '@/stores/session';

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
 * in, and the changes to them. A change shows at once and is undone if TMDB
 * does not take it.
 */
export const useAccountStore = defineStore('account', () => {
  const session = useSessionStore();
  // By title, such as "movie-603".
  const states = ref<Record<string, AccountStates>>({});
  // The changes on their way, such as "watchlist:movie-603".
  const saving = ref<Record<string, boolean>>({});

  // Someone else signed in, or nobody is: what was known no longer holds.
  watch(
    () => session.account?.id,
    () => {
      states.value = {};
      saving.value = {};
    },
  );

  /** TMDB says nobody is signed in: the app learns it too. */
  function check<T>(answer: Result<T>) {
    if (!answer.ok && answer.error.code === 'signed-out') {
      void session.load();
    }

    return answer;
  }

  const statesOf = (title: TitleRequest): AccountStates | undefined =>
    states.value[key(title)];

  const isSaving = (list: AccountList, title: TitleRequest) =>
    !!saving.value[`${list}:${key(title)}`];

  async function load(title: TitleRequest) {
    const answer = check(await settle(() => getApi().account.states(title)));

    if (answer.ok) {
      states.value[key(title)] = answer.data;
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

  return { states, statesOf, isSaving, load, toggle };
});
