// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Account,
  SessionKeeping,
  SessionState,
} from '../../../shared/api';
import { TmdbError, type Access } from '../../../shared/tmdb/client';
import type { CallbackOutcome, LoopbackOptions } from './loopback';
import {
  createAuthService,
  LOGIN_TIMEOUT_MS,
  RECHECK_DELAYS_MS,
} from './service';
import type { SavedSession, SessionStore } from './session-store';

const NOW = 1_800_000_000_000;
// A v4 request token, as the access token of the app gets: a JWT.
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ2IjoxfQ.cmVxdWVzdA';
const SESSION = 'the-session-id-works-as-a-password';
const ACCESS: Access = {
  sessionId: SESSION,
  accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.dXNlcg',
  accountObjectId: '5f0c4a1b2c3d4e5f6a7b8c9d',
};
const ACCOUNT: Account = { id: 7, username: 'ada', name: 'Ada Lovelace' };
const LOOPBACK_URL = `http://127.0.0.1:50123/callback/${'a'.repeat(32)}`;
// The way back is in the token itself.
const AUTHORIZE_URL = `https://www.themoviedb.org/auth/access?request_token=${TOKEN}`;

const PENDING: SessionState = {
  status: 'pending',
  expiresAt: NOW + LOGIN_TIMEOUT_MS,
  authorizeUrl: AUTHORIZE_URL,
};
const SIGNED_IN: SessionState = {
  status: 'authenticated',
  account: ACCOUNT,
  kept: 'encrypted',
  offline: false,
};
const ANONYMOUS: SessionState = { status: 'anonymous' };
const SAVED: SavedSession = { ...ACCESS, account: ACCOUNT };

// What TMDB v4 answers for a request token that is not approved.
const notApproved = () =>
  new TmdbError(
    'invalid-request',
    422,
    "This request token hasn't been approved by the user.",
    41,
  );
const offline = () => new TmdbError('network');
const appRefused = () =>
  new TmdbError('unauthorized', 401, 'Invalid API key', 7);
// What TMDB answers for a session that was ended.
const sessionOver = () =>
  new TmdbError('unauthorized', 401, 'Authentication failed', 3);

/**
 * Stands in for session-store.ts. `keyring: false` is a system without one:
 * nothing is saved until the user agrees.
 */
function fakeStore({ keyring = true } = {}) {
  const kept: SessionKeeping = keyring ? 'encrypted' : 'unencrypted';
  const held: { saved: SavedSession | null } = { saved: null };
  const store = Object.assign(held, {
    load: vi.fn<SessionStore['load']>(async () =>
      held.saved ? { session: held.saved, kept } : null,
    ),
    save: vi.fn<SessionStore['save']>(async (session, evenUnencrypted) => {
      if (!keyring && !evenUnencrypted) {
        return 'ask';
      }

      held.saved = session;

      return kept;
    }),
    clear: vi.fn<SessionStore['clear']>(async () => {
      held.saved = null;
    }),
  });

  return store;
}

/** A promise that the test settles when it wants to. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function setup(store = fakeStore()) {
  const tmdb = {
    createRequestToken: vi.fn<(redirectTo?: string) => Promise<string>>(
      async () => TOKEN,
    ),
    createSession: vi.fn<(requestToken: string) => Promise<Access>>(
      async () => ACCESS,
    ),
    account: vi.fn<(sessionId: string) => Promise<Account>>(
      async () => ACCOUNT,
    ),
    deleteSession: vi.fn<(access: Partial<Access>) => Promise<void>>(
      async () => {},
    ),
  };
  const loopback = { url: LOOPBACK_URL, close: vi.fn(async () => {}) };
  let listening: LoopbackOptions | undefined;
  const startLoopback = vi.fn(async (options: LoopbackOptions) => {
    listening = options;

    return loopback;
  });
  const openExternal = vi.fn<(url: string) => Promise<void>>(async () => {});
  const changes: SessionState[] = [];
  const service = createAuthService({
    tmdb,
    startLoopback,
    openExternal,
    store,
    onChange: (state) => changes.push(state),
    now: () => NOW,
  });

  return {
    service,
    tmdb,
    store,
    loopback,
    startLoopback,
    openExternal,
    changes,
    /** TMDB sent the browser back to the app. Resolves to the page shown. */
    browserComesBack: (): Promise<CallbackOutcome> => listening!.onCallback(),
    page: (outcome: CallbackOutcome) => listening!.page(outcome),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('auth service', () => {
  it('starts with nobody signed in', () => {
    const { service, changes } = setup();

    expect(service.getSession()).toEqual(ANONYMOUS);
    expect(changes).toEqual([]);
  });

  describe('starting a login', () => {
    it('opens the approval page of TMDB, with the way back to the app', async () => {
      const { service, tmdb, openExternal, changes } = setup();

      await expect(service.login('en')).resolves.toEqual(PENDING);

      // the way back is opened first: a v4 token is told it when it is made
      expect(tmdb.createRequestToken).toHaveBeenCalledExactlyOnceWith(
        LOOPBACK_URL,
      );
      expect(openExternal).toHaveBeenCalledExactlyOnceWith(AUTHORIZE_URL);
      expect(service.getSession()).toEqual(PENDING);
      expect(changes).toEqual([PENDING]);
    });

    it('signs in through v3 with a key: the way back goes in the address of the approval page', async () => {
      const { service, tmdb, openExternal, browserComesBack, store } = setup();
      tmdb.createRequestToken.mockResolvedValue('a1b2c3d4e5f6');
      tmdb.createSession.mockResolvedValue({ sessionId: SESSION });

      await service.login('en');

      expect(openExternal).toHaveBeenCalledExactlyOnceWith(
        `https://www.themoviedb.org/authenticate/a1b2c3d4e5f6?redirect_to=${encodeURIComponent(LOOPBACK_URL)}`,
      );
      await expect(browserComesBack()).resolves.toBe('done');
      expect(store.saved).toEqual({ sessionId: SESSION, account: ACCOUNT });
    });

    it('asks for one request token however often it is asked to start', async () => {
      const { service, tmdb, openExternal } = setup();

      const [first, second] = await Promise.all([
        service.login('en'),
        service.login('en'),
      ]);
      const third = await service.login('en');

      expect([first, second, third]).toEqual([PENDING, PENDING, PENDING]);
      expect(tmdb.createRequestToken).toHaveBeenCalledTimes(1);
      expect(openExternal).toHaveBeenCalledTimes(1);
    });

    it('still works without a way back: the user confirms by hand', async () => {
      const { service, startLoopback, openExternal } = setup();
      startLoopback.mockRejectedValue(new Error('listen EACCES'));

      const state = await service.login('en');

      expect(state).toEqual(PENDING);
      expect(openExternal).toHaveBeenCalledExactlyOnceWith(AUTHORIZE_URL);
      await expect(service.confirmManual()).resolves.toEqual(SIGNED_IN);
    });

    it('still waits when the browser did not open: the page shows the address', async () => {
      const { service, openExternal, browserComesBack } = setup();
      openExternal.mockRejectedValue(new Error('no browser'));

      await expect(service.login('en')).resolves.toEqual(PENDING);
      await expect(browserComesBack()).resolves.toBe('done');
    });

    it.each([
      ['TMDB cannot be reached', offline, 'network'],
      ['TMDB refuses the app', appRefused, 'unavailable'],
      [
        'the app has no credential',
        () => new TmdbError('missing-credential'),
        'unavailable',
      ],
    ] as const)(
      'fails when %s, before opening anything',
      async (_case, error, reason) => {
        const { service, tmdb, loopback, openExternal } = setup();
        tmdb.createRequestToken.mockRejectedValue(error());

        await expect(service.login('en')).resolves.toEqual({
          status: 'error',
          reason,
        });
        // nothing stays listening
        expect(loopback.close).toHaveBeenCalled();
        expect(openExternal).not.toHaveBeenCalled();
      },
    );

    it('starts over after a failure', async () => {
      const { service, tmdb } = setup();
      tmdb.createRequestToken.mockRejectedValueOnce(offline());

      await service.login('en');

      await expect(service.login('en')).resolves.toEqual(PENDING);
    });
  });

  describe('the browser coming back', () => {
    it('signs the user in and stops listening', async () => {
      const { service, tmdb, loopback, changes, browserComesBack } = setup();
      await service.login('en');

      await expect(browserComesBack()).resolves.toBe('done');

      expect(service.getSession()).toEqual(SIGNED_IN);
      expect(changes).toEqual([PENDING, SIGNED_IN]);
      expect(tmdb.createSession).toHaveBeenCalledExactlyOnceWith(TOKEN);
      expect(tmdb.account).toHaveBeenCalledExactlyOnceWith(SESSION);
      expect(loopback.close).toHaveBeenCalled();
    });

    it('never tells anyone the session itself', async () => {
      const { service, changes, browserComesBack } = setup();
      await service.login('en');
      await browserComesBack();

      expect(JSON.stringify([changes, service.getSession()])).not.toContain(
        SESSION,
      );
    });

    it('means the user refused when TMDB will not trade the token', async () => {
      const { service, tmdb, loopback, browserComesBack } = setup();
      tmdb.createSession.mockRejectedValue(notApproved());
      await service.login('en');

      await expect(browserComesBack()).resolves.toBe('failed');

      expect(service.getSession()).toEqual({
        status: 'error',
        reason: 'denied',
      });
      expect(loopback.close).toHaveBeenCalled();
    });

    it('keeps waiting when TMDB could not be asked: the approval is not lost', async () => {
      const { service, tmdb, browserComesBack } = setup();
      tmdb.createSession.mockRejectedValueOnce(offline());
      await service.login('en');

      await expect(browserComesBack()).resolves.toBe('failed');
      expect(service.getSession()).toEqual(PENDING);

      await expect(service.confirmManual()).resolves.toEqual(SIGNED_IN);
    });

    it('gives up when TMDB refuses the app itself', async () => {
      const { service, tmdb, browserComesBack } = setup();
      tmdb.createSession.mockRejectedValue(appRefused());
      await service.login('en');

      await expect(browserComesBack()).resolves.toBe('failed');

      expect(service.getSession()).toEqual({
        status: 'error',
        reason: 'unavailable',
      });
    });

    it('ends a session whose account cannot be read, instead of keeping it', async () => {
      const { service, tmdb, browserComesBack } = setup();
      tmdb.account.mockRejectedValue(offline());
      await service.login('en');

      await expect(browserComesBack()).resolves.toBe('failed');

      expect(tmdb.deleteSession).toHaveBeenCalledExactlyOnceWith(ACCESS);
      expect(service.getSession()).toEqual({
        status: 'error',
        reason: 'network',
      });
    });

    it('answers the browser in the language the login was started in', async () => {
      const { service, page } = setup();
      await service.login('pt-BR');

      expect(page('done')).toContain('Login concluído');
    });
  });

  describe('confirming by hand', () => {
    it('keeps waiting while the access is not approved, then signs in', async () => {
      const { service, tmdb, changes } = setup();
      tmdb.createSession.mockRejectedValueOnce(notApproved());
      await service.login('en');

      await expect(service.confirmManual()).resolves.toEqual(PENDING);
      await expect(service.confirmManual()).resolves.toEqual(SIGNED_IN);

      expect(changes).toEqual([PENDING, SIGNED_IN]);
    });

    it('shares one trade with the browser coming back at the same moment', async () => {
      const { service, tmdb, browserComesBack } = setup();
      await service.login('en');

      const [byHand, page] = await Promise.all([
        service.confirmManual(),
        browserComesBack(),
      ]);

      expect(byHand).toEqual(SIGNED_IN);
      expect(page).toBe('done');
      // The token works once: a second trade would be refused.
      expect(tmdb.createSession).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no login is waiting', async () => {
      const { service, tmdb } = setup();

      await expect(service.confirmManual()).resolves.toEqual(ANONYMOUS);
      expect(tmdb.createSession).not.toHaveBeenCalled();
    });
  });

  describe('giving up', () => {
    it('stops waiting after five minutes', async () => {
      vi.useFakeTimers();
      const { service, loopback, browserComesBack, tmdb } = setup();
      await service.login('en');

      vi.advanceTimersByTime(LOGIN_TIMEOUT_MS - 1);
      expect(service.getSession()).toEqual(PENDING);
      expect(loopback.close).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(service.getSession()).toEqual({
        status: 'error',
        reason: 'timeout',
      });
      expect(loopback.close).toHaveBeenCalled();

      // Too late now, whatever the browser does.
      await expect(browserComesBack()).resolves.toBe('failed');
      expect(tmdb.createSession).not.toHaveBeenCalled();
    });

    it('cancels: nothing listening, no timer left, nobody signed in', async () => {
      vi.useFakeTimers();
      const { service, loopback, changes, browserComesBack, tmdb } = setup();
      await service.login('en');

      expect(service.cancelLogin()).toEqual(ANONYMOUS);

      expect(loopback.close).toHaveBeenCalled();
      vi.advanceTimersByTime(LOGIN_TIMEOUT_MS * 2);
      expect(changes).toEqual([PENDING, ANONYMOUS]);
      await expect(browserComesBack()).resolves.toBe('failed');
      expect(tmdb.createSession).not.toHaveBeenCalled();
    });

    it('ends at TMDB a session that arrives after the cancel', async () => {
      const { service, tmdb, browserComesBack } = setup();
      const answer = deferred<Access>();
      tmdb.createSession.mockReturnValue(answer.promise);
      await service.login('en');

      const page = browserComesBack();
      service.cancelLogin();
      answer.resolve(ACCESS);

      await expect(page).resolves.toBe('failed');
      expect(tmdb.deleteSession).toHaveBeenCalledExactlyOnceWith(ACCESS);
      expect(tmdb.account).not.toHaveBeenCalled();
      expect(service.getSession()).toEqual(ANONYMOUS);
    });

    it('dismisses a login that failed', async () => {
      const { service, tmdb } = setup();
      tmdb.createRequestToken.mockRejectedValue(offline());
      await service.login('en');

      expect(service.cancelLogin()).toEqual(ANONYMOUS);
    });

    it('leaves a signed in user alone', async () => {
      const { service, browserComesBack } = setup();
      await service.login('en');
      await browserComesBack();

      expect(service.cancelLogin()).toEqual(SIGNED_IN);
    });

    it('leaves nothing behind when the app quits', async () => {
      vi.useFakeTimers();
      const { service, loopback, changes } = setup();
      await service.login('en');

      service.dispose();

      expect(loopback.close).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      expect(changes).toEqual([PENDING]);
    });
  });

  describe('signing out', () => {
    async function signedIn() {
      const context = setup();

      await context.service.login('en');
      await context.browserComesBack();

      return context;
    }

    it('ends the session at TMDB', async () => {
      const { service, tmdb, changes } = await signedIn();

      await expect(service.logout()).resolves.toEqual(ANONYMOUS);

      expect(tmdb.deleteSession).toHaveBeenCalledExactlyOnceWith(ACCESS);
      expect(changes.at(-1)).toEqual(ANONYMOUS);
    });

    it('signs out here even when TMDB cannot be told', async () => {
      const { service, tmdb } = await signedIn();
      tmdb.deleteSession.mockRejectedValue(offline());

      await expect(service.logout()).resolves.toEqual(ANONYMOUS);
      expect(service.getSession()).toEqual(ANONYMOUS);
    });

    it('forgets the session: a second sign out has nothing to end', async () => {
      const { service, tmdb } = await signedIn();

      await service.logout();
      await service.logout();

      expect(tmdb.deleteSession).toHaveBeenCalledTimes(1);
    });

    it('also gives up a login that is waiting', async () => {
      const { service, tmdb, loopback } = setup();
      await service.login('en');

      await expect(service.logout()).resolves.toEqual(ANONYMOUS);

      expect(loopback.close).toHaveBeenCalled();
      expect(tmdb.deleteSession).not.toHaveBeenCalled();
    });

    it('lets the user sign in again', async () => {
      const { service, browserComesBack } = await signedIn();
      await service.logout();

      await expect(service.login('en')).resolves.toEqual(PENDING);
      await expect(browserComesBack()).resolves.toBe('done');
      expect(service.getSession()).toEqual(SIGNED_IN);
    });

    it('removes the session saved for the next launch', async () => {
      const { service, store } = await signedIn();
      expect(store.saved).toEqual(SAVED);

      await service.logout();

      expect(store.clear).toHaveBeenCalled();
      expect(store.saved).toBeNull();
    });
  });

  describe('keeping the session for the next launch', () => {
    async function signIn(context: ReturnType<typeof setup>) {
      await context.service.login('en');

      return context.browserComesBack();
    }

    it('saves it, encrypted, as soon as the user is signed in', async () => {
      const context = setup();

      await expect(signIn(context)).resolves.toBe('done');

      expect(context.store.save).toHaveBeenCalledExactlyOnceWith(
        SAVED,
        undefined,
      );
      expect(context.service.getSession()).toEqual(SIGNED_IN);
    });

    it('without a keyring, keeps it only once the user agrees', async () => {
      const context = setup(fakeStore({ keyring: false }));
      await signIn(context);

      expect(context.service.getSession()).toEqual({
        ...SIGNED_IN,
        kept: 'ask',
      });
      expect(context.store.saved).toBeNull();

      await expect(context.service.remember()).resolves.toEqual({
        ...SIGNED_IN,
        kept: 'unencrypted',
      });
      expect(context.store.saved).toEqual(SAVED);
      expect(context.changes.at(-1)).toEqual({
        ...SIGNED_IN,
        kept: 'unencrypted',
      });
    });

    it('has nothing to remember otherwise', async () => {
      const context = setup();

      await expect(context.service.remember()).resolves.toEqual(ANONYMOUS);
      await signIn(context);
      await expect(context.service.remember()).resolves.toEqual(SIGNED_IN);

      expect(context.store.save).toHaveBeenCalledTimes(1);
    });

    it('still signs in when the session cannot be saved', async () => {
      const context = setup();
      context.store.save.mockResolvedValueOnce('failed');
      await signIn(context);
      expect(context.service.getSession()).toEqual({
        ...SIGNED_IN,
        kept: 'failed',
      });

      await context.service.logout();
      context.store.save.mockRejectedValueOnce(new Error('EACCES'));
      await signIn(context);
      expect(context.service.getSession()).toEqual({
        ...SIGNED_IN,
        kept: 'failed',
      });
    });

    it('keeps nothing of a login cancelled while it was being saved', async () => {
      const context = setup();
      const saving = deferred<SessionKeeping>();
      context.store.save.mockImplementationOnce(async (session) => {
        context.store.saved = session;

        return saving.promise;
      });
      await context.service.login('en');

      const page = context.browserComesBack();
      await vi.waitFor(() => expect(context.store.save).toHaveBeenCalled());
      context.service.cancelLogin();
      saving.resolve('encrypted');

      await expect(page).resolves.toBe('failed');
      expect(context.store.saved).toBeNull();
      expect(context.tmdb.deleteSession).toHaveBeenCalledExactlyOnceWith(
        ACCESS,
      );
      expect(context.service.getSession()).toEqual(ANONYMOUS);
    });

    it('removes what a save wrote when the sign out came during it', async () => {
      const context = setup(fakeStore({ keyring: false }));
      await signIn(context);
      const saving = deferred<SessionKeeping>();
      context.store.save.mockImplementationOnce(async (session) => {
        context.store.saved = session;

        return saving.promise;
      });

      const remembering = context.service.remember();
      const signingOut = context.service.logout();
      saving.resolve('unencrypted');

      await expect(remembering).resolves.toEqual(ANONYMOUS);
      await expect(signingOut).resolves.toEqual(ANONYMOUS);
      expect(context.store.saved).toBeNull();
    });
  });

  describe('requests of the account', () => {
    async function signedIn() {
      const store = fakeStore();
      store.saved = SAVED;
      const running = setup(store);

      await running.service.restore();

      return running;
    }

    it('runs them with the session, which never leaves the service', async () => {
      const { service } = await signedIn();
      const work = vi.fn(async (sessionId: string, account: Account) => [
        sessionId,
        account.id,
      ]);

      await expect(service.withSession(work)).resolves.toEqual([SESSION, 7]);
    });

    it('refuses them when nobody is signed in', async () => {
      const { service } = setup();
      const work = vi.fn(async () => 'never');

      await expect(service.withSession(work)).rejects.toMatchObject({
        code: 'signed-out',
      });
      expect(work).not.toHaveBeenCalled();
    });

    it('signs out when TMDB says the session is over', async () => {
      const { service, store, changes } = await signedIn();

      await expect(
        service.withSession(async () => Promise.reject(sessionOver())),
      ).rejects.toMatchObject({ code: 'signed-out', status: 401 });

      expect(service.getSession()).toEqual(ANONYMOUS);
      expect(changes.at(-1)).toEqual(ANONYMOUS);
      expect(store.saved).toBeNull();
    });

    it('stays signed in after any other failure', async () => {
      const { service } = await signedIn();

      await expect(
        service.withSession(async () => Promise.reject(appRefused())),
      ).rejects.toMatchObject({ code: 'unauthorized', tmdbStatus: 7 });
      await expect(
        service.withSession(async () => Promise.reject(offline())),
      ).rejects.toMatchObject({ code: 'network' });

      expect(service.getSession()).toMatchObject({ status: 'authenticated' });
    });

    it('gives what signing in gave to what needs more than the session', async () => {
      const { service } = await signedIn();
      const work = vi.fn(async (access: Access) => access);

      await expect(service.withAccess(work)).resolves.toEqual(ACCESS);
    });

    it('gives nothing when nobody is signed in', async () => {
      const { service } = setup();
      const work = vi.fn(async () => 'never');

      await expect(service.withAccess(work)).rejects.toMatchObject({
        code: 'signed-out',
      });
      expect(work).not.toHaveBeenCalled();
    });
  });

  describe('at launch', () => {
    const flush = () => vi.advanceTimersByTimeAsync(0);

    function launch(store = fakeStore()) {
      store.saved = SAVED;

      return setup(store);
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('stays signed out when nothing was saved', async () => {
      const { service, tmdb, changes } = setup();

      await expect(service.restore()).resolves.toEqual(ANONYMOUS);

      expect(tmdb.account).not.toHaveBeenCalled();
      expect(changes).toEqual([]);
    });

    it('signs in at once with the saved session, and confirms it with TMDB', async () => {
      const { service, tmdb, changes } = launch();
      const answer = deferred<Account>();
      tmdb.account.mockReturnValue(answer.promise);

      await expect(service.restore()).resolves.toEqual(SIGNED_IN);
      expect(tmdb.account).toHaveBeenCalledExactlyOnceWith(SESSION);

      answer.resolve(ACCOUNT);
      await flush();

      expect(service.getSession()).toEqual(SIGNED_IN);
      expect(changes).toEqual([SIGNED_IN]);
    });

    it('does not start a login over the saved session', async () => {
      const { service, tmdb } = launch();
      await service.restore();

      await expect(service.login('en')).resolves.toEqual(SIGNED_IN);
      expect(tmdb.createRequestToken).not.toHaveBeenCalled();
    });

    it('saves the account again when it changed on TMDB', async () => {
      const { service, tmdb, store } = launch();
      const renamed = { ...ACCOUNT, name: 'Augusta Ada King' };
      tmdb.account.mockResolvedValue(renamed);

      await service.restore();
      await flush();

      expect(service.getSession()).toEqual({ ...SIGNED_IN, account: renamed });
      expect(store.saved).toEqual({ ...SAVED, account: renamed });
    });

    it('signs out when the session was ended at TMDB', async () => {
      const { service, tmdb, store, changes } = launch();
      tmdb.account.mockRejectedValue(sessionOver());

      await service.restore();
      await flush();

      expect(service.getSession()).toEqual(ANONYMOUS);
      expect(changes).toEqual([SIGNED_IN, ANONYMOUS]);
      expect(store.saved).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each([
      ['TMDB cannot be reached', offline],
      ['TMDB refuses the app', appRefused],
    ])('stays signed in when %s, and asks again later', async (_, failure) => {
      const { service, tmdb, store } = launch();
      tmdb.account.mockRejectedValueOnce(failure());

      await service.restore();
      await flush();

      expect(service.getSession()).toEqual({ ...SIGNED_IN, offline: true });
      expect(store.clear).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(RECHECK_DELAYS_MS[0]);

      expect(tmdb.account).toHaveBeenCalledTimes(2);
      expect(service.getSession()).toEqual(SIGNED_IN);
    });

    it('asks less and less often while TMDB stays out of reach', async () => {
      const { service, tmdb } = launch();
      tmdb.account.mockRejectedValue(offline());
      await service.restore();
      await flush();

      for (const [index, delay] of [
        ...RECHECK_DELAYS_MS,
        RECHECK_DELAYS_MS.at(-1)!,
      ].entries()) {
        await vi.advanceTimersByTimeAsync(delay - 1);
        expect(tmdb.account).toHaveBeenCalledTimes(index + 1);
        await vi.advanceTimersByTimeAsync(1);
        expect(tmdb.account).toHaveBeenCalledTimes(index + 2);
      }

      expect(service.getSession()).toEqual({ ...SIGNED_IN, offline: true });
    });

    it('stops asking once the user signs out', async () => {
      const { service, tmdb, store } = launch();
      tmdb.account.mockRejectedValue(offline());
      await service.restore();
      await flush();

      await service.logout();

      expect(vi.getTimerCount()).toBe(0);
      expect(store.saved).toBeNull();
      expect(tmdb.deleteSession).toHaveBeenCalledExactlyOnceWith(ACCESS);
    });

    it('ignores an answer that arrives after the sign out', async () => {
      const { service, tmdb, store } = launch();
      const answer = deferred<Account>();
      tmdb.account.mockReturnValue(answer.promise);
      await service.restore();

      await service.logout();
      answer.resolve({ ...ACCOUNT, name: 'Augusta Ada King' });
      await flush();

      expect(service.getSession()).toEqual(ANONYMOUS);
      expect(store.save).not.toHaveBeenCalled();
    });

    it('keeps a session the user agreed to keep unencrypted', async () => {
      const { service, tmdb, store } = launch(fakeStore({ keyring: false }));
      const renamed = { ...ACCOUNT, name: 'Augusta Ada King' };
      tmdb.account.mockResolvedValue(renamed);

      await expect(service.restore()).resolves.toEqual({
        ...SIGNED_IN,
        kept: 'unencrypted',
      });
      await flush();

      expect(store.save).toHaveBeenCalledExactlyOnceWith(
        { ...SAVED, account: renamed },
        true,
      );
      expect(service.getSession()).toEqual({
        ...SIGNED_IN,
        account: renamed,
        kept: 'unencrypted',
      });
    });

    it('leaves no timer behind when the app quits', async () => {
      const { service, tmdb } = launch();
      tmdb.account.mockRejectedValue(offline());
      await service.restore();
      await flush();

      service.dispose();

      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
