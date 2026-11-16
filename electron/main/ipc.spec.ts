// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IPC,
  type CredentialStatus,
  type MediaDetails,
  type SessionState,
} from '../../shared/api';
import { registerIpc, type IpcEvent, type IpcServices } from './ipc';
import { TmdbError } from '../../shared/tmdb/client';

const APP_URL = 'file:///opt/media-app/dist/index.html#/search';
const KEY = '0123456789abcdef0123456789abcdef';
const SAVED: CredentialStatus = {
  hasKey: true,
  persisted: true,
  encrypted: true,
  builtIn: true,
};
const NONE: CredentialStatus = {
  hasKey: false,
  persisted: false,
  encrypted: false,
  builtIn: false,
};

const ANONYMOUS: SessionState = { status: 'anonymous' };
const PENDING: SessionState = {
  status: 'pending',
  expiresAt: 1_800_000_000_000,
  authorizeUrl: 'https://www.themoviedb.org/authenticate/a1b2c3',
};
const SIGNED_IN: SessionState = {
  status: 'authenticated',
  account: { id: 7, username: 'ada' },
};

const fromApp: IpcEvent = { senderFrame: { url: APP_URL } };
const fromElsewhere: IpcEvent = {
  senderFrame: { url: 'https://example.com/' },
};
const search = { type: 'movie', query: 'matrix', page: 1, language: 'en' };
const details = { type: 'movie', id: 603, language: 'pt-BR', region: 'BR' };
const MATRIX: MediaDetails = {
  type: 'movie',
  id: 603,
  title: 'Matrix',
  genres: [],
  cast: [],
};

describe('ipc handlers', () => {
  let handlers: Map<string, (event: IpcEvent, ...args: unknown[]) => unknown>;
  let services: {
    [K in keyof IpcServices]: IpcServices[K];
  };

  // Handlers may answer right away or with a promise: always await them.
  const call = async (channel: string, event: IpcEvent, ...args: unknown[]) =>
    handlers.get(channel)!(event, ...args);

  beforeEach(() => {
    handlers = new Map();
    services = {
      isTrustedSender: (url) => url === APP_URL,
      setNativeTheme: vi.fn(),
      tmdb: {
        search: vi.fn(async () => ({
          page: 1,
          results: [{ id: 603 }],
          totalPages: 1,
          totalResults: 1,
        })),
        details: vi.fn(async () => MATRIX),
        list: vi.fn(async () => [{ id: 603, media_type: 'movie' as const }]),
      },
      genres: { get: vi.fn(async () => [{ id: 28, name: 'Action' }]) },
      account: {
        states: vi.fn(async () => ({
          watchlist: true,
          favorite: false,
          rated: 8.5,
        })),
        mark: vi.fn(async () => null),
        rate: vi.fn(async () => null),
        list: vi.fn(async () => ({
          page: 1,
          results: [{ id: 603, media_type: 'movie' as const }],
          totalPages: 1,
          totalResults: 1,
        })),
      },
      credentials: {
        status: vi.fn(() => NONE),
        save: vi.fn(async () => SAVED),
        clear: vi.fn(async () => NONE),
      },
      auth: {
        getSession: vi.fn(() => SIGNED_IN),
        login: vi.fn(async () => PENDING),
        confirmManual: vi.fn(async () => SIGNED_IN),
        cancelLogin: vi.fn(() => ANONYMOUS),
        logout: vi.fn(async () => ANONYMOUS),
        remember: vi.fn(async () => SIGNED_IN),
      },
    };

    const register = (
      channel: string,
      listener: (event: IpcEvent, ...args: unknown[]) => unknown,
    ) => {
      handlers.set(channel, listener);
    };

    registerIpc({ on: register, handle: register }, services);
  });

  it('registers every channel of the api', () => {
    expect([...handlers.keys()].sort()).toEqual(Object.values(IPC).sort());
  });

  describe('search', () => {
    it('answers with the page', async () => {
      await expect(call(IPC.tmdbSearch, fromApp, search)).resolves.toEqual({
        ok: true,
        data: {
          page: 1,
          results: [{ id: 603 }],
          totalPages: 1,
          totalResults: 1,
        },
      });
      expect(services.tmdb.search).toHaveBeenCalledWith(search);
    });

    it('turns a TMDB error into a failure the renderer can read', async () => {
      vi.mocked(services.tmdb.search).mockRejectedValue(
        new TmdbError('unauthorized', 401, 'Invalid API key'),
      );

      await expect(call(IPC.tmdbSearch, fromApp, search)).resolves.toEqual({
        ok: false,
        error: {
          code: 'unauthorized',
          status: 401,
          message: 'Invalid API key',
        },
      });
    });

    it('does not let an unexpected error escape', async () => {
      vi.mocked(services.tmdb.search).mockRejectedValue(new Error('boom'));

      await expect(call(IPC.tmdbSearch, fromApp, search)).resolves.toEqual({
        ok: false,
        error: { code: 'server', message: 'boom' },
      });
    });

    it('rejects a malformed request without searching', async () => {
      await expect(
        call(IPC.tmdbSearch, fromApp, { ...search, page: 9999 }),
      ).resolves.toEqual({ ok: false, error: { code: 'invalid-request' } });
      expect(services.tmdb.search).not.toHaveBeenCalled();
    });

    it('rejects a sender that is not the app', async () => {
      await expect(
        call(IPC.tmdbSearch, fromElsewhere, search),
      ).resolves.toEqual({ ok: false, error: { code: 'invalid-request' } });
      expect(await call(IPC.tmdbSearch, { senderFrame: null }, search)).toEqual(
        { ok: false, error: { code: 'invalid-request' } },
      );
      expect(services.tmdb.search).not.toHaveBeenCalled();
    });
  });

  describe('lists of the account', () => {
    const title = { type: 'movie', id: 603 };
    const mark = { ...title, list: 'watchlist', value: true };
    const rate = { ...title, value: 8.5 };
    const page = { list: 'favorite', type: 'tv', page: 2, language: 'pt-BR' };

    it('answers where a title is, puts it in a list and reads a list', async () => {
      await expect(call(IPC.accountStates, fromApp, title)).resolves.toEqual({
        ok: true,
        data: { watchlist: true, favorite: false, rated: 8.5 },
      });
      await expect(call(IPC.accountMark, fromApp, mark)).resolves.toEqual({
        ok: true,
        data: null,
      });
      await expect(call(IPC.accountList, fromApp, page)).resolves.toMatchObject(
        { ok: true, data: { results: [{ id: 603 }] } },
      );
      expect(services.account.states).toHaveBeenCalledWith(title);
      expect(services.account.mark).toHaveBeenCalledWith(mark);
      expect(services.account.list).toHaveBeenCalledWith(page);
    });

    it('rates a title, and takes the rating away', async () => {
      await expect(call(IPC.accountRate, fromApp, rate)).resolves.toEqual({
        ok: true,
        data: null,
      });
      await expect(
        call(IPC.accountRate, fromApp, { ...title, value: null }),
      ).resolves.toEqual({ ok: true, data: null });
      expect(services.account.rate).toHaveBeenNthCalledWith(1, rate);
      expect(services.account.rate).toHaveBeenNthCalledWith(2, {
        ...title,
        value: null,
      });
    });

    it('says when nobody is signed in', async () => {
      vi.mocked(services.account.mark).mockRejectedValue(
        new TmdbError('signed-out'),
      );

      await expect(call(IPC.accountMark, fromApp, mark)).resolves.toMatchObject(
        { ok: false, error: { code: 'signed-out' } },
      );
    });

    it.each([
      [IPC.accountStates, { ...title, id: -1 }],
      [IPC.accountMark, { ...mark, value: 'yes' }],
      [IPC.accountMark, { ...mark, list: 'rated' }],
      [IPC.accountList, { ...page, type: 'person' }],
      [IPC.accountList, { ...page, page: 0 }],
      [IPC.accountRate, { ...rate, value: 11 }],
      [IPC.accountRate, { ...rate, value: 8.25 }],
      [IPC.accountRate, title],
    ])('rejects a malformed request on %s', async (channel, request) => {
      await expect(call(channel, fromApp, request)).resolves.toEqual({
        ok: false,
        error: { code: 'invalid-request' },
      });
      expect(services.account.states).not.toHaveBeenCalled();
      expect(services.account.mark).not.toHaveBeenCalled();
      expect(services.account.rate).not.toHaveBeenCalled();
      expect(services.account.list).not.toHaveBeenCalled();
    });

    it('rejects a sender that is not the app', async () => {
      for (const [channel, request] of [
        [IPC.accountStates, title],
        [IPC.accountMark, mark],
        [IPC.accountRate, rate],
        [IPC.accountList, page],
      ] as const) {
        await expect(call(channel, fromElsewhere, request)).resolves.toEqual({
          ok: false,
          error: { code: 'invalid-request' },
        });
      }
      expect(services.account.mark).not.toHaveBeenCalled();
      expect(services.account.rate).not.toHaveBeenCalled();
    });
  });

  describe('details', () => {
    it('answers with the page of the title', async () => {
      await expect(call(IPC.tmdbDetails, fromApp, details)).resolves.toEqual({
        ok: true,
        data: MATRIX,
      });
      expect(services.tmdb.details).toHaveBeenCalledWith(details);
    });

    it('turns a title TMDB does not know into a failure', async () => {
      vi.mocked(services.tmdb.details).mockRejectedValue(
        new TmdbError('not-found', 404),
      );

      await expect(call(IPC.tmdbDetails, fromApp, details)).resolves.toEqual({
        ok: false,
        error: { code: 'not-found', status: 404, message: 'not-found' },
      });
    });

    it.each([
      ['a type the app does not show', { ...details, type: 'person' }],
      ['an id that is not a number', { ...details, id: '603/videos' }],
      ['a region that is not a country', { ...details, region: '../BR' }],
    ])('rejects %s without asking', async (_case, request) => {
      await expect(call(IPC.tmdbDetails, fromApp, request)).resolves.toEqual({
        ok: false,
        error: { code: 'invalid-request' },
      });
      expect(services.tmdb.details).not.toHaveBeenCalled();
    });

    it('rejects a sender that is not the app', async () => {
      await expect(
        call(IPC.tmdbDetails, fromElsewhere, details),
      ).resolves.toEqual({ ok: false, error: { code: 'invalid-request' } });
      expect(services.tmdb.details).not.toHaveBeenCalled();
    });
  });

  describe('lists of the home page', () => {
    const trending = { list: 'trending', language: 'pt-BR' };

    it('answers with the titles of the list', async () => {
      await expect(call(IPC.tmdbList, fromApp, trending)).resolves.toEqual({
        ok: true,
        data: [{ id: 603, media_type: 'movie' }],
      });
      expect(services.tmdb.list).toHaveBeenCalledWith(trending);
    });

    it.each([
      ['a list the app does not show', { ...trending, list: 'top_rated' }],
      ['a path of TMDB', { ...trending, list: '/account' }],
      ['a language that is not a locale', { ...trending, language: '..' }],
    ])('rejects %s without asking', async (_case, request) => {
      await expect(call(IPC.tmdbList, fromApp, request)).resolves.toEqual({
        ok: false,
        error: { code: 'invalid-request' },
      });
      expect(services.tmdb.list).not.toHaveBeenCalled();
    });

    it('rejects a sender that is not the app', async () => {
      await expect(
        call(IPC.tmdbList, fromElsewhere, trending),
      ).resolves.toEqual({ ok: false, error: { code: 'invalid-request' } });
      expect(services.tmdb.list).not.toHaveBeenCalled();
    });
  });

  describe('genres', () => {
    it('answers with the list of a valid language', async () => {
      await expect(call(IPC.tmdbGenres, fromApp, 'pt-BR')).resolves.toEqual({
        ok: true,
        data: [{ id: 28, name: 'Action' }],
      });
      expect(services.genres.get).toHaveBeenCalledWith('pt-BR');
    });

    it('rejects a language that could escape the cache folder', async () => {
      await expect(
        call(IPC.tmdbGenres, fromApp, '../../secrets'),
      ).resolves.toEqual({ ok: false, error: { code: 'invalid-request' } });
      expect(services.genres.get).not.toHaveBeenCalled();
    });
  });

  describe('credentials', () => {
    it('saves a key that looks like one', async () => {
      await expect(
        call(IPC.credentialSave, fromApp, ` ${KEY} `),
      ).resolves.toEqual(SAVED);
      expect(services.credentials.save).toHaveBeenCalledWith(KEY);
    });

    it('does not save something that is not a key', async () => {
      expect(await call(IPC.credentialSave, fromApp, 'nope')).toEqual(NONE);
      expect(services.credentials.save).not.toHaveBeenCalled();
    });

    it('reports and clears the key for the app', async () => {
      vi.mocked(services.credentials.status).mockReturnValue(SAVED);

      expect(await call(IPC.credentialStatus, fromApp)).toEqual(SAVED);
      await expect(call(IPC.credentialClear, fromApp)).resolves.toEqual(NONE);
      expect(services.credentials.clear).toHaveBeenCalled();
    });

    it('tells other senders nothing and changes nothing for them', async () => {
      vi.mocked(services.credentials.status).mockReturnValue(SAVED);

      expect(await call(IPC.credentialStatus, fromElsewhere)).toEqual(NONE);
      expect(await call(IPC.credentialSave, fromElsewhere, KEY)).toEqual(NONE);
      expect(await call(IPC.credentialClear, fromElsewhere)).toEqual(NONE);
      expect(services.credentials.save).not.toHaveBeenCalled();
      expect(services.credentials.clear).not.toHaveBeenCalled();
    });
  });

  describe('auth', () => {
    it('tells the app who is signed in', async () => {
      expect(await call(IPC.authSession, fromApp)).toEqual(SIGNED_IN);
    });

    it('starts a login with the language of the app', async () => {
      await expect(call(IPC.authLogin, fromApp, 'pt-BR')).resolves.toEqual(
        PENDING,
      );
      expect(services.auth.login).toHaveBeenCalledWith('pt-BR');
    });

    it.each([undefined, 42, '../../etc', 'english'])(
      'starts the login in English when the language is %s',
      async (language) => {
        await call(IPC.authLogin, fromApp, language);

        expect(services.auth.login).toHaveBeenCalledWith('en');
      },
    );

    it('confirms, cancels and signs out for the app', async () => {
      await expect(call(IPC.authConfirm, fromApp)).resolves.toEqual(SIGNED_IN);
      expect(await call(IPC.authCancel, fromApp)).toEqual(ANONYMOUS);
      await expect(call(IPC.authLogout, fromApp)).resolves.toEqual(ANONYMOUS);

      expect(services.auth.confirmManual).toHaveBeenCalled();
      expect(services.auth.cancelLogin).toHaveBeenCalled();
      expect(services.auth.logout).toHaveBeenCalled();
    });

    it('keeps the session when the app asks to', async () => {
      await expect(call(IPC.authRemember, fromApp)).resolves.toEqual(SIGNED_IN);
      expect(services.auth.remember).toHaveBeenCalled();
    });

    it('tells other senders nothing and does nothing for them', async () => {
      for (const channel of [
        IPC.authSession,
        IPC.authLogin,
        IPC.authConfirm,
        IPC.authCancel,
        IPC.authLogout,
        IPC.authRemember,
      ]) {
        expect(await call(channel, fromElsewhere, 'en')).toEqual(ANONYMOUS);
        expect(await call(channel, { senderFrame: null }, 'en')).toEqual(
          ANONYMOUS,
        );
      }

      for (const method of Object.values(services.auth)) {
        expect(method).not.toHaveBeenCalled();
      }
    });
  });

  describe('native theme', () => {
    it('applies a valid theme sent by the app', async () => {
      await call(IPC.setNativeTheme, fromApp, 'dark');

      expect(services.setNativeTheme).toHaveBeenCalledWith('dark');
    });

    it('ignores an unknown theme or another sender', async () => {
      await call(IPC.setNativeTheme, fromApp, 'purple');
      await call(IPC.setNativeTheme, fromElsewhere, 'dark');

      expect(services.setNativeTheme).not.toHaveBeenCalled();
    });
  });
});
