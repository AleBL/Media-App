import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { SessionState } from '@shared/api';
import { getApi } from '@/services/api';

/**
 * Who is signed in to TMDB. The session itself stays with the main process
 * (desktop) or the site (web).
 */
export const useSessionStore = defineStore('session', () => {
  const state = ref<SessionState>({ status: 'anonymous' });
  // The user said they approved, and TMDB did not agree.
  const notConfirmed = ref(false);
  const busy = ref(false);
  let stopListening: (() => void) | undefined;
  let markLoaded!: () => void;
  // Resolves after the first answer about the session, or its failure.
  const loaded = new Promise<void>((resolve) => {
    markLoaded = resolve;
  });

  const account = computed(() =>
    state.value.status === 'authenticated' ? state.value.account : null,
  );

  function setState(next: SessionState) {
    state.value = next;

    if (next.status !== 'pending') {
      notConfirmed.value = false;
    }
  }

  async function whileBusy(request: () => Promise<SessionState>) {
    busy.value = true;

    try {
      setState(await request());
    } finally {
      busy.value = false;
    }

    return state.value;
  }

  /**
   * Reads the session and keeps listening: a login ends when the user
   * approves in the browser, not on a click here.
   */
  async function load() {
    try {
      stopListening ??= getApi().auth.onChange(setState);
      setState(await getApi().auth.getSession());
    } finally {
      markLoaded();
    }
  }

  const whenLoaded = () => loaded;

  const login = (language: string) =>
    whileBusy(() => getApi().auth.login(language));

  /** For when the browser did not return by itself after the approval. */
  async function confirm() {
    const next = await whileBusy(() => getApi().auth.confirmManual());

    notConfirmed.value = next.status === 'pending';
  }

  const cancel = () => whileBusy(() => getApi().auth.cancelLogin());

  const logout = () => whileBusy(() => getApi().auth.logout());

  /** Saves the session unencrypted, on a system without a keyring. */
  const remember = () => whileBusy(() => getApi().auth.remember());

  return {
    state,
    account,
    notConfirmed,
    busy,
    load,
    whenLoaded,
    login,
    confirm,
    cancel,
    logout,
    remember,
  };
});
