// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Account, SessionState } from '../../../shared/api';
import { TmdbError } from '../../../shared/tmdb/client';
import type { CallbackOutcome, LoopbackOptions } from './loopback';
import { createAuthService, LOGIN_TIMEOUT_MS } from './service';

const NOW = 1_800_000_000_000;
const TOKEN = 'a1b2c3d4e5f6';
const SESSION = 'the-session-id-works-as-a-password';
const ACCOUNT: Account = { id: 7, username: 'ada', name: 'Ada Lovelace' };
const LOOPBACK_URL = 'http://127.0.0.1:50123/callback';
const AUTHORIZE_URL = `https://www.themoviedb.org/authenticate/${TOKEN}?redirect_to=http%3A%2F%2F127.0.0.1%3A50123%2Fcallback`;

const PENDING: SessionState = {
  status: 'pending',
  expiresAt: NOW + LOGIN_TIMEOUT_MS,
  authorizeUrl: AUTHORIZE_URL,
};
const SIGNED_IN: SessionState = { status: 'authenticated', account: ACCOUNT };
const ANONYMOUS: SessionState = { status: 'anonymous' };

// What TMDB answers for a request token that is not approved.
const notApproved = () =>
  new TmdbError('unauthorized', 401, 'Session denied.', 17);
const offline = () => new TmdbError('network');
const appRefused = () =>
  new TmdbError('unauthorized', 401, 'Invalid API key', 7);

/** A promise that the test settles when it wants to. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function setup() {
  const tmdb = {
    createRequestToken: vi.fn(async () => TOKEN),
    createSession: vi.fn<(requestToken: string) => Promise<string>>(
      async () => SESSION,
    ),
    account: vi.fn<(sessionId: string) => Promise<Account>>(
      async () => ACCOUNT,
    ),
    deleteSession: vi.fn<(sessionId: string) => Promise<void>>(async () => {}),
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
    onChange: (state) => changes.push(state),
    now: () => NOW,
  });

  return {
    service,
    tmdb,
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
      const { service, openExternal, startLoopback, changes } = setup();

      await expect(service.login('en')).resolves.toEqual(PENDING);

      expect(openExternal).toHaveBeenCalledExactlyOnceWith(AUTHORIZE_URL);
      expect(startLoopback.mock.calls[0][0].requestToken).toBe(TOKEN);
      expect(service.getSession()).toEqual(PENDING);
      expect(changes).toEqual([PENDING]);
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

      const bare = `https://www.themoviedb.org/authenticate/${TOKEN}`;
      expect(state).toEqual({ ...PENDING, authorizeUrl: bare });
      expect(openExternal).toHaveBeenCalledExactlyOnceWith(bare);
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
        const { service, tmdb, startLoopback, openExternal } = setup();
        tmdb.createRequestToken.mockRejectedValue(error());

        await expect(service.login('en')).resolves.toEqual({
          status: 'error',
          reason,
        });
        expect(startLoopback).not.toHaveBeenCalled();
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

      expect(tmdb.deleteSession).toHaveBeenCalledExactlyOnceWith(SESSION);
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
      const answer = deferred<string>();
      tmdb.createSession.mockReturnValue(answer.promise);
      await service.login('en');

      const page = browserComesBack();
      service.cancelLogin();
      answer.resolve(SESSION);

      await expect(page).resolves.toBe('failed');
      expect(tmdb.deleteSession).toHaveBeenCalledExactlyOnceWith(SESSION);
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

      expect(tmdb.deleteSession).toHaveBeenCalledExactlyOnceWith(SESSION);
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
  });
});
