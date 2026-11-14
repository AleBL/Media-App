// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC, type CredentialStatus } from '../../shared/api';
import { registerIpc, type IpcEvent, type IpcServices } from './ipc';
import { TmdbError } from './tmdb/client';

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

const fromApp: IpcEvent = { senderFrame: { url: APP_URL } };
const fromElsewhere: IpcEvent = {
  senderFrame: { url: 'https://example.com/' },
};
const search = { type: 'movie', query: 'matrix', page: 1, language: 'en' };

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
      },
      genres: { get: vi.fn(async () => [{ id: 28, name: 'Action' }]) },
      credentials: {
        status: vi.fn(() => NONE),
        save: vi.fn(async () => SAVED),
        clear: vi.fn(async () => NONE),
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
