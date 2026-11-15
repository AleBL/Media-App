import type { Account, LoginFailure, SessionState } from '../../../shared/api';
import type { TmdbClient } from '../../../shared/tmdb/client';
import {
  authorizeUrl,
  isSessionDenied,
  isTemporary,
  loginFailure,
} from '../../../shared/tmdb/login';
import { callbackPage } from './callback-page';
import type { CallbackOutcome, Loopback, LoopbackOptions } from './loopback';

/** How long the user has to approve on the TMDB website. */
export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export interface AuthServiceOptions {
  tmdb: Pick<
    TmdbClient,
    'createRequestToken' | 'createSession' | 'account' | 'deleteSession'
  >;
  startLoopback: (options: LoopbackOptions) => Promise<Loopback>;
  /** Opens a page in the browser of the system. */
  openExternal: (url: string) => Promise<void>;
  /** Told about every change, to pass it on to the renderer. */
  onChange?: (state: SessionState) => void;
  timeoutMs?: number;
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
 * The session lives here, in the main process, and nowhere else: the
 * renderer is only told who signed in.
 */
export function createAuthService(options: AuthServiceOptions) {
  const { tmdb } = options;
  const timeoutMs = options.timeoutMs ?? LOGIN_TIMEOUT_MS;
  const now = options.now ?? Date.now;

  let state: SessionState = { status: 'anonymous' };
  let sessionId: string | null = null;
  let attempt: Attempt | null = null;
  let starting: Promise<SessionState> | null = null;

  function set(next: SessionState) {
    state = next;
    options.onChange?.(next);

    return next;
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

    end(current);
    sessionId = id;
    set({ status: 'authenticated', account });

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

    /** Signs out here first, so being offline never keeps anyone signed in. */
    async logout(): Promise<SessionState> {
      const id = sessionId;

      sessionId = null;

      if (attempt) {
        end(attempt);
      }

      if (state.status !== 'anonymous') {
        set({ status: 'anonymous' });
      }

      if (id) {
        await discard(id);
      }

      return state;
    },

    /** For when the app quits: leaves no timer and no server behind. */
    dispose() {
      if (attempt) {
        end(attempt);
      }
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
