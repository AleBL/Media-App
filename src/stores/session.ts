import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { SessionState } from '@shared/api';
import { getApi } from '@/services/api';

/**
 * Who is signed in to TMDB, if anyone. The session itself stays with
 * whoever holds the credential of the app (the main process, in the desktop
 * app): here there is only what the app shows of it.
 */
export const useSessionStore = defineStore('session', () => {
  const state = ref<SessionState>({ status: 'anonymous' });
  // The user said the approval was done, and TMDB did not agree.
  const notConfirmed = ref(false);
  // An answer about the session is on its way.
  const busy = ref(false);
  let stopListening: (() => void) | undefined;

  const account = computed(() =>
    state.value.status === 'authenticated' ? state.value.account : null,
  );

  function apply(next: SessionState) {
    state.value = next;

    if (next.status !== 'pending') {
      notConfirmed.value = false;
    }
  }

  async function ask(request: () => Promise<SessionState>) {
    busy.value = true;

    try {
      apply(await request());
    } finally {
      busy.value = false;
    }

    return state.value;
  }

  /**
   * Reads the session and keeps following it: a login ends when the user
   * approves it in the browser, not when something is clicked here.
   */
  async function load() {
    stopListening ??= getApi().auth.onChange(apply);
    apply(await getApi().auth.getSession());
  }

  /** Opens the approval page of TMDB, with the result page in `language`. */
  const login = (language: string) => ask(() => getApi().auth.login(language));

  /** For when the browser did not come back by itself after the approval. */
  async function confirm() {
    const next = await ask(() => getApi().auth.confirmManual());

    notConfirmed.value = next.status === 'pending';
  }

  /** Gives up a login that is waiting, or dismisses one that failed. */
  const cancel = () => ask(() => getApi().auth.cancelLogin());

  const logout = () => ask(() => getApi().auth.logout());

  return {
    state,
    account,
    notConfirmed,
    busy,
    load,
    login,
    confirm,
    cancel,
    logout,
  };
});
