import type {
  Account,
  LoginFailure,
  SessionPersistence,
  SessionState,
} from '../../../shared/api';
import {
  TmdbError,
  type Access,
  type TmdbClient,
} from '../../../shared/tmdb/client';
import {
  authorizeUrl,
  isSessionExpired,
  isTemporaryError,
  isTokenNotApproved,
  toLoginFailure,
} from '../../../shared/tmdb/login';
import { callbackPage } from './callback-page';
import type { CallbackOutcome, Loopback, LoopbackOptions } from './loopback';
import type { SessionStore } from './session-store';

export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

/** Waits between checks of a saved session TMDB could not confirm. The last repeats. */
export const RECHECK_DELAYS_MS = [
  15_000,
  30_000,
  60_000,
  2 * 60_000,
  5 * 60_000,
] as const;

export interface AuthServiceOptions {
  tmdb: Pick<
    TmdbClient,
    'createRequestToken' | 'createSession' | 'account' | 'deleteSession'
  >;
  startLoopback: (options: LoopbackOptions) => Promise<Loopback>;
  /** Opens a page in the system browser. */
  openExternal: (url: string) => Promise<void>;
  store: Pick<SessionStore, 'load' | 'save' | 'clear'>;
  onChange?: (state: SessionState) => void;
  timeoutMs?: number;
  recheckDelaysMs?: readonly number[];
  now?: () => number;
}

interface LoginAttempt {
  /** Empty until TMDB gives it: the loopback is opened first. */
  requestToken: string;
  loopback: Loopback | null;
  timer?: ReturnType<typeof setTimeout>;
  exchange?: Promise<ExchangeResult>;
}

type ExchangeResult =
  | 'authenticated'
  /** The token is not approved. */
  | 'refused'
  /** TMDB could not be reached; the token is still good. */
  | 'retry'
  /** The attempt ended some other way, already shown in the state. */
  | 'over';

/**
 * TMDB sign-in: the app gets a request token, the user approves it on the
 * TMDB website in their browser, and the app exchanges it for a session.
 *
 * The session lives only here and on disk (session-store.ts); the renderer
 * is only told who signed in.
 */
export function createAuthService(options: AuthServiceOptions) {
  const { tmdb, store } = options;
  const timeoutMs = options.timeoutMs ?? LOGIN_TIMEOUT_MS;
  const recheckDelays = options.recheckDelaysMs ?? RECHECK_DELAYS_MS;
  const now = options.now ?? Date.now;

  let state: SessionState = { status: 'anonymous' };
  let access: Access | null = null;
  let persistence: SessionPersistence = 'failed';
  let pendingLogin: LoginAttempt | null = null;
  let loginStarting: Promise<SessionState> | null = null;
  let recheckTimer: ReturnType<typeof setTimeout> | undefined;
  let failedChecks = 0;
  let storageQueue: Promise<unknown> = Promise.resolve();

  function setState(next: SessionState) {
    state = next;
    options.onChange?.(next);

    return next;
  }

  function setSignedIn(account: Account, offline = false) {
    const next: SessionState = {
      status: 'authenticated',
      account,
      persistence,
      offline,
    };

    // Unchanged: nothing to notify.
    return JSON.stringify(next) === JSON.stringify(state)
      ? state
      : setState(next);
  }

  // Storage operations run one after the other, so a logout during a save
  // removes what was written instead of racing it.
  function queueStorage<T>(task: () => Promise<T>): Promise<T> {
    const next = storageQueue.then(task, task);

    storageQueue = next.catch(() => {});

    return next;
  }

  const saveSession = (
    granted: Access,
    account: Account,
    evenUnencrypted?: boolean,
  ) =>
    queueStorage(() =>
      store.save({ ...granted, account }, evenUnencrypted),
    ).catch((): SessionPersistence => 'failed');

  const clearSavedSession = () =>
    queueStorage(() => store.clear()).catch(() => {});

  async function signOutExpired() {
    access = null;
    clearTimeout(recheckTimer);
    setState({ status: 'anonymous' });
    await clearSavedSession();
  }

  /** Asks TMDB whether a session saved by an earlier launch still works. */
  async function verifySession(saved: Access) {
    clearTimeout(recheckTimer);

    let account: Account;

    try {
      account = await tmdb.account(saved.sessionId);
    } catch (error) {
      if (access !== saved || state.status !== 'authenticated') {
        return;
      }

      if (isSessionExpired(error)) {
        await signOutExpired();

        return;
      }

      // Being offline is no reason to sign anyone out.
      setSignedIn(state.account, true);
      recheckTimer = setTimeout(
        () => void verifySession(saved),
        recheckDelays[Math.min(failedChecks, recheckDelays.length - 1)],
      );
      failedChecks += 1;

      return;
    }

    if (access !== saved || state.status !== 'authenticated') {
      return;
    }

    failedChecks = 0;

    // The account changed on TMDB: save it for the next offline launch.
    if (JSON.stringify(account) !== JSON.stringify(state.account)) {
      const newPersistence = await saveSession(
        saved,
        account,
        persistence === 'unencrypted',
      );

      if (access !== saved) {
        return;
      }

      persistence = newPersistence;
    }

    setSignedIn(account);
  }

  /** Clears the timer and closes the loopback. */
  function stopWaiting(attempt: LoginAttempt) {
    clearTimeout(attempt.timer);
    void attempt.loopback?.close();

    if (pendingLogin === attempt) {
      pendingLogin = null;
    }
  }

  function failLogin(attempt: LoginAttempt, reason: LoginFailure) {
    stopWaiting(attempt);
    setState({ status: 'error', reason });
  }

  /** Revokes at TMDB what the app is not going to use. */
  async function revokeAccess(unused: Access) {
    try {
      await tmdb.deleteSession(unused);
    } catch {
      // Forgotten here either way.
    }
  }

  async function exchangeToken(attempt: LoginAttempt): Promise<ExchangeResult> {
    let granted: Access;

    try {
      granted = await tmdb.createSession(attempt.requestToken);
    } catch (error) {
      if (pendingLogin !== attempt) {
        return 'over';
      }

      if (isTokenNotApproved(error)) {
        return 'refused';
      }

      if (isTemporaryError(error)) {
        return 'retry';
      }

      failLogin(attempt, 'unavailable');

      return 'over';
    }

    // Cancelled or timed out while TMDB was answering.
    if (pendingLogin !== attempt) {
      await revokeAccess(granted);

      return 'over';
    }

    let account: Account;

    try {
      account = await tmdb.account(granted.sessionId);
    } catch (error) {
      // The request token is spent: no retry is possible.
      await revokeAccess(granted);

      if (pendingLogin === attempt) {
        failLogin(attempt, toLoginFailure(error));
      }

      return 'over';
    }

    if (pendingLogin !== attempt) {
      await revokeAccess(granted);

      return 'over';
    }

    const newPersistence = await saveSession(granted, account);

    // Cancelled while saving.
    if (pendingLogin !== attempt) {
      await clearSavedSession();
      await revokeAccess(granted);

      return 'over';
    }

    stopWaiting(attempt);
    access = granted;
    persistence = newPersistence;
    failedChecks = 0;
    setSignedIn(account);

    return 'authenticated';
  }

  // A token can be exchanged only once, so the browser callback and a manual
  // confirmation at the same moment share one request.
  function exchangeTokenOnce(attempt: LoginAttempt) {
    attempt.exchange ??= exchangeToken(attempt).finally(() => {
      attempt.exchange = undefined;
    });

    return attempt.exchange;
  }

  async function handleCallback(
    attempt: LoginAttempt,
  ): Promise<CallbackOutcome> {
    if (pendingLogin !== attempt) {
      return 'failed';
    }

    const result = await exchangeTokenOnce(attempt);

    // TMDB only redirects after the user answered, so a refused token means
    // the user denied it.
    if (result === 'refused' && pendingLogin === attempt) {
      failLogin(attempt, 'denied');
    }

    return result === 'authenticated' ? 'done' : 'failed';
  }

  async function startLogin(language: string): Promise<SessionState> {
    const attempt: LoginAttempt = { requestToken: '', loopback: null };

    // First, because a v4 request token takes the redirect when created.
    try {
      attempt.loopback = await options.startLoopback({
        onCallback: () => handleCallback(attempt),
        page: (outcome) => callbackPage(language, outcome),
      });
    } catch {
      // Without a loopback the user confirms by hand (confirmManual).
    }

    try {
      attempt.requestToken = await tmdb.createRequestToken(
        attempt.loopback?.url,
      );
    } catch (error) {
      void attempt.loopback?.close();

      return setState({ status: 'error', reason: toLoginFailure(error) });
    }

    const url = authorizeUrl(attempt.requestToken, attempt.loopback?.url);

    pendingLogin = attempt;

    try {
      await options.openExternal(url);
    } catch {
      // The renderer shows the url to open by hand.
    }

    // Cancelled while the browser was opening.
    if (pendingLogin !== attempt) {
      return state;
    }

    attempt.timer = setTimeout(() => {
      if (pendingLogin === attempt) {
        failLogin(attempt, 'timeout');
      }
    }, timeoutMs);

    return setState({
      status: 'pending',
      expiresAt: now() + timeoutMs,
      authorizeUrl: url,
    });
  }

  return {
    getSession: () => state,

    /** Signs in with the saved session at once, then verifies it in the background. */
    async restore(): Promise<SessionState> {
      const saved = await queueStorage(() => store.load()).catch(() => null);

      if (!saved || state.status !== 'anonymous') {
        return state;
      }

      const { account, ...savedAccess } = saved.session;

      access = savedAccess;
      persistence = saved.persistence;
      failedChecks = 0;
      setSignedIn(account);
      void verifySession(savedAccess);

      return state;
    },

    /** A login already pending is left as it is. */
    login(language: string): Promise<SessionState> {
      if (state.status === 'pending' || state.status === 'authenticated') {
        return Promise.resolve(state);
      }

      loginStarting ??= startLogin(language).finally(() => {
        loginStarting = null;
      });

      return loginStarting;
    },

    /** Until the token is approved, the login keeps waiting. */
    async confirmManual(): Promise<SessionState> {
      if (pendingLogin) {
        await exchangeTokenOnce(pendingLogin);
      }

      return state;
    },

    cancelLogin(): SessionState {
      if (pendingLogin) {
        stopWaiting(pendingLogin);
      }

      return state.status === 'pending' || state.status === 'error'
        ? setState({ status: 'anonymous' })
        : state;
    },

    /** Saves the session unencrypted, after the user agreed (`persistence: 'ask'`). */
    async remember(): Promise<SessionState> {
      const current = access;

      if (
        !current ||
        state.status !== 'authenticated' ||
        persistence !== 'ask'
      ) {
        return state;
      }

      const newPersistence = await saveSession(current, state.account, true);

      // Signed out meanwhile, which removed what was written.
      if (access !== current || state.status !== 'authenticated') {
        return state;
      }

      persistence = newPersistence;

      return setSignedIn(state.account, state.offline);
    },

    /**
     * Runs `task` with the session, which never leaves this process. An
     * expired session signs the user out and fails with `signed-out`.
     */
    async withSession<T>(
      task: (sessionId: string, account: Account) => Promise<T>,
    ): Promise<T> {
      const current = access;

      if (!current || state.status !== 'authenticated') {
        throw new TmdbError('signed-out');
      }

      try {
        return await task(current.sessionId, state.account);
      } catch (error) {
        if (!isSessionExpired(error)) {
          throw error;
        }

        if (access === current) {
          await signOutExpired();
        }

        throw new TmdbError('signed-out', 401);
      }
    },

    /** Runs `task` with everything signing in gave (the lists need the access token). */
    async withAccess<T>(task: (access: Access) => Promise<T>): Promise<T> {
      const current = access;

      if (!current || state.status !== 'authenticated') {
        throw new TmdbError('signed-out');
      }

      return task(current);
    },

    /** Signs out locally first, so being offline never keeps anyone signed in. */
    async logout(): Promise<SessionState> {
      const previousAccess = access;

      access = null;
      clearTimeout(recheckTimer);

      if (pendingLogin) {
        stopWaiting(pendingLogin);
      }

      if (state.status !== 'anonymous') {
        setState({ status: 'anonymous' });
      }

      await clearSavedSession();

      if (previousAccess) {
        await revokeAccess(previousAccess);
      }

      return state;
    },

    /** On quit: leaves no timer or server behind. */
    dispose() {
      clearTimeout(recheckTimer);

      if (pendingLogin) {
        stopWaiting(pendingLogin);
      }
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
