import type {
  Account,
  LoginFailure,
  SessionKeeping,
  SessionState,
} from '../../../shared/api';
import { TmdbError, type TmdbClient } from '../../../shared/tmdb/client';
import {
  authorizeUrl,
  isSessionDenied,
  isSessionOver,
  isTemporary,
  loginFailure,
} from '../../../shared/tmdb/login';
import { callbackPage } from './callback-page';
import type { CallbackOutcome, Loopback, LoopbackOptions } from './loopback';
import type { SessionStore } from './session-store';

/** How long the user has to approve on the TMDB website. */
export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * How long the app waits before asking TMDB again about a saved session it
 * could not confirm, one after the other. The last one repeats.
 */
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
  /** Opens a page in the browser of the system. */
  openExternal: (url: string) => Promise<void>;
  /** Where the session waits for the next launch. */
  store: Pick<SessionStore, 'load' | 'save' | 'clear'>;
  /** Told about every change, to pass it on to the renderer. */
  onChange?: (state: SessionState) => void;
  timeoutMs?: number;
  recheckDelaysMs?: readonly number[];
  now?: () => number;
}

/** One login waiting for the user to approve it. */
interface Attempt {
  requestToken: string;
  loopback: Loopback | null;
  timer?: ReturnType<typeof setTimeout>;
  trading?: Promise<Trade>;
}

type Trade =
  | 'authenticated'
  /** TMDB will not trade the token: it is not approved. */
  | 'refused'
  /** TMDB could not be asked. The token is still good. */
  | 'retry'
  /** The login ended in some other way, already reflected in the state. */
  | 'over';

/**
 * Signing in to TMDB, the way TMDB asks apps to do it: the app gets a
 * request token, the user approves it on the TMDB website, in their own
 * browser, and the app trades the approved token for a session.
 *
 * The session lives here, in the main process, and on disk for the next
 * launch (session-store.ts), and nowhere else: the renderer is only told
 * who signed in.
 */
export function createAuthService(options: AuthServiceOptions) {
  const { tmdb, store } = options;
  const timeoutMs = options.timeoutMs ?? LOGIN_TIMEOUT_MS;
  const recheckDelays = options.recheckDelaysMs ?? RECHECK_DELAYS_MS;
  const now = options.now ?? Date.now;

  let state: SessionState = { status: 'anonymous' };
  let sessionId: string | null = null;
  let kept: SessionKeeping = 'failed';
  let attempt: Attempt | null = null;
  let starting: Promise<SessionState> | null = null;
  let recheck: ReturnType<typeof setTimeout> | undefined;
  let rechecks = 0;
  let storing: Promise<unknown> = Promise.resolve();

  function set(next: SessionState) {
    state = next;
    options.onChange?.(next);

    return next;
  }

  function signIn(account: Account, offline = false) {
    const next: SessionState = {
      status: 'authenticated',
      account,
      kept,
      offline,
    };

    // A check that changes nothing has nothing to tell.
    return JSON.stringify(next) === JSON.stringify(state) ? state : set(next);
  }

  // One after the other: a sign out that comes while the session is being
  // saved removes what was written, instead of racing it.
  function keep<T>(work: () => Promise<T>): Promise<T> {
    const next = storing.then(work, work);

    storing = next.catch(() => {});

    return next;
  }

  const save = (id: string, account: Account, evenUnencrypted?: boolean) =>
    keep(() => store.save({ sessionId: id, account }, evenUnencrypted)).catch(
      (): SessionKeeping => 'failed',
    );

  const forget = () => keep(() => store.clear()).catch(() => {});

  /** TMDB no longer knows the session: whoever it was is signed out. */
  async function over() {
    sessionId = null;
    clearTimeout(recheck);
    set({ status: 'anonymous' });
    await forget();
  }

  /** Asks TMDB whether the session saved by an earlier launch still works. */
  async function check(id: string) {
    clearTimeout(recheck);

    let account: Account;

    try {
      account = await tmdb.account(id);
    } catch (error) {
      if (sessionId !== id || state.status !== 'authenticated') {
        return;
      }

      // Ended in this app on another launch, or on the TMDB website.
      if (isSessionOver(error)) {
        await over();

        return;
      }

      // Nothing else says the session is over, and being offline is no
      // reason to sign anyone out.
      signIn(state.account, true);
      recheck = setTimeout(
        () => void check(id),
        recheckDelays[Math.min(rechecks, recheckDelays.length - 1)],
      );
      rechecks += 1;

      return;
    }

    if (sessionId !== id || state.status !== 'authenticated') {
      return;
    }

    rechecks = 0;

    // Changed on TMDB: the next launch shows the new name while offline.
    if (JSON.stringify(account) !== JSON.stringify(state.account)) {
      const keeping = await save(id, account, kept === 'unencrypted');

      if (sessionId !== id) {
        return;
      }

      kept = keeping;
    }

    signIn(account);
  }

  /** Stops waiting: no timer running and nothing listening. */
  function end(ended: Attempt) {
    clearTimeout(ended.timer);
    void ended.loopback?.close();

    if (attempt === ended) {
      attempt = null;
    }
  }

  function fail(ended: Attempt, reason: LoginFailure) {
    end(ended);
    set({ status: 'error', reason });
  }

  /** Ends at TMDB a session that the app is not going to use. */
  async function discard(id: string) {
    try {
      await tmdb.deleteSession(id);
    } catch {
      // It is forgotten here either way, which is all the app can do.
    }
  }

  async function trade(current: Attempt): Promise<Trade> {
    let id: string;

    try {
      id = await tmdb.createSession(current.requestToken);
    } catch (error) {
      if (attempt !== current) {
        return 'over';
      }

      if (isSessionDenied(error)) {
        return 'refused';
      }

      if (isTemporary(error)) {
        return 'retry';
      }

      fail(current, 'unavailable');

      return 'over';
    }

    // Cancelled or timed out while TMDB was answering.
    if (attempt !== current) {
      await discard(id);

      return 'over';
    }

    let account: Account;

    try {
      account = await tmdb.account(id);
    } catch (error) {
      // The request token is spent: there is no trying again with it.
      await discard(id);

      if (attempt === current) {
        fail(current, loginFailure(error));
      }

      return 'over';
    }

    if (attempt !== current) {
      await discard(id);

      return 'over';
    }

    const keeping = await save(id, account);

    // Cancelled while the session was being saved.
    if (attempt !== current) {
      await forget();
      await discard(id);

      return 'over';
    }

    end(current);
    sessionId = id;
    kept = keeping;
    rechecks = 0;
    signIn(account);

    return 'authenticated';
  }

  // A request token is traded once, so the browser coming back and the user
  // confirming by hand at the same moment must share one request.
  function tradeOnce(current: Attempt) {
    current.trading ??= trade(current).finally(() => {
      current.trading = undefined;
    });

    return current.trading;
  }

  /** The browser came back from TMDB. */
  async function comeBack(current: Attempt): Promise<CallbackOutcome> {
    if (attempt !== current) {
      return 'failed';
    }

    const result = await tradeOnce(current);

    // TMDB only sends the browser back after the user answered, so a token
    // it still refuses is one the user did not approve.
    if (result === 'refused' && attempt === current) {
      fail(current, 'denied');
    }

    return result === 'authenticated' ? 'done' : 'failed';
  }

  async function start(language: string): Promise<SessionState> {
    let requestToken: string;

    try {
      requestToken = await tmdb.createRequestToken();
    } catch (error) {
      return set({ status: 'error', reason: loginFailure(error) });
    }

    const current: Attempt = { requestToken, loopback: null };

    try {
      current.loopback = await options.startLoopback({
        requestToken,
        onCallback: () => comeBack(current),
        page: (outcome) => callbackPage(language, outcome),
      });
    } catch {
      // The browser has no way back to the app then. The login still works:
      // the user says when the approval is done (confirmManual).
    }

    const url = authorizeUrl(requestToken, current.loopback?.url);

    attempt = current;

    try {
      await options.openExternal(url);
    } catch {
      // The renderer shows the address, to be opened by hand.
    }

    // Cancelled while the browser was opening.
    if (attempt !== current) {
      return state;
    }

    current.timer = setTimeout(() => {
      if (attempt === current) {
        fail(current, 'timeout');
      }
    }, timeoutMs);

    return set({
      status: 'pending',
      expiresAt: now() + timeoutMs,
      authorizeUrl: url,
    });
  }

  return {
    getSession: () => state,

    /**
     * Signs in with the session that an earlier launch saved, if there is
     * one. Who it is shows at once, and TMDB is asked in the background
     * whether the session still works.
     */
    async restore(): Promise<SessionState> {
      const saved = await keep(() => store.load()).catch(() => null);

      if (!saved || state.status !== 'anonymous') {
        return state;
      }

      sessionId = saved.session.sessionId;
      kept = saved.kept;
      rechecks = 0;
      signIn(saved.session.account);
      void check(sessionId);

      return state;
    },

    /** Opens the approval page. A login already going on is left as it is. */
    login(language: string): Promise<SessionState> {
      if (state.status === 'pending' || state.status === 'authenticated') {
        return Promise.resolve(state);
      }

      starting ??= start(language).finally(() => {
        starting = null;
      });

      return starting;
    },

    /**
     * Asks TMDB whether the access was approved, for when the browser did
     * not come back. Until it is approved the login just keeps waiting.
     */
    async confirmManual(): Promise<SessionState> {
      if (attempt) {
        await tradeOnce(attempt);
      }

      return state;
    },

    /** Gives up a login that is waiting, or dismisses one that failed. */
    cancelLogin(): SessionState {
      if (attempt) {
        end(attempt);
      }

      return state.status === 'pending' || state.status === 'error'
        ? set({ status: 'anonymous' })
        : state;
    },

    /**
     * Keeps the session for the next launch on a system without a keyring,
     * once the user agreed to keep it unencrypted.
     */
    async remember(): Promise<SessionState> {
      const id = sessionId;

      if (!id || state.status !== 'authenticated' || kept !== 'ask') {
        return state;
      }

      const keeping = await save(id, state.account, true);

      // Signed out meanwhile, which removed what was written.
      if (sessionId !== id || state.status !== 'authenticated') {
        return state;
      }

      kept = keeping;

      return signIn(state.account, state.offline);
    },

    /**
     * Asks TMDB something of the account of whoever signed in, with their
     * session, which never leaves this process. Nobody signed in, or a
     * session that TMDB says is over, is `signed-out`; the second also signs
     * them out here.
     */
    async withSession<T>(
      work: (sessionId: string, account: Account) => Promise<T>,
    ): Promise<T> {
      const id = sessionId;

      if (!id || state.status !== 'authenticated') {
        throw new TmdbError('signed-out');
      }

      try {
        return await work(id, state.account);
      } catch (error) {
        if (!isSessionOver(error)) {
          throw error;
        }

        if (sessionId === id) {
          await over();
        }

        throw new TmdbError('signed-out', 401);
      }
    },

    /** Signs out here first, so being offline never keeps anyone signed in. */
    async logout(): Promise<SessionState> {
      const id = sessionId;

      sessionId = null;
      clearTimeout(recheck);

      if (attempt) {
        end(attempt);
      }

      if (state.status !== 'anonymous') {
        set({ status: 'anonymous' });
      }

      await forget();

      if (id) {
        await discard(id);
      }

      return state;
    },

    /** For when the app quits: leaves no timer and no server behind. */
    dispose() {
      clearTimeout(recheck);

      if (attempt) {
        end(attempt);
      }
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
