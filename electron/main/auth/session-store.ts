import type { Account, SessionPersistence } from '../../../shared/api';
import type { Access } from '../../../shared/tmdb/client';
import { createSecretFile, type Encryption } from '../secret-file';

export const ENCRYPTED_FILE = 'tmdb-session.bin';
export const PLAIN_FILE = 'tmdb-session.txt';

/** Sessions saved before the v4 login have no access token. */
export interface SavedSession extends Access {
  /** Shown while TMDB cannot be reached. */
  account: Account;
}

const nonEmpty = (value: unknown) =>
  typeof value === 'string' && value ? value : undefined;

function parseSavedSession(text: string): SavedSession | null {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  const { sessionId, accessToken, accountObjectId, account } = (value ??
    {}) as Record<string, unknown>;
  const { id, username, name, avatarPath } = (account ?? {}) as Record<
    string,
    unknown
  >;

  if (
    typeof sessionId !== 'string' ||
    !sessionId ||
    typeof id !== 'number' ||
    typeof username !== 'string'
  ) {
    return null;
  }

  const v4 = {
    accessToken: nonEmpty(accessToken),
    accountObjectId: nonEmpty(accountObjectId),
  };

  return {
    sessionId,
    // Both or neither: one is useless without the other.
    ...(v4.accessToken && v4.accountObjectId ? v4 : {}),
    account: {
      id,
      username,
      ...(typeof name === 'string' ? { name } : {}),
      ...(typeof avatarPath === 'string' ? { avatarPath } : {}),
    },
  };
}

/**
 * Saves the session for the next launch. It works as a password, so without
 * a keyring it is only written after the user agrees.
 */
export function createSessionStore(directory: string, encryption: Encryption) {
  const file = createSecretFile(
    directory,
    { encrypted: ENCRYPTED_FILE, plain: PLAIN_FILE },
    encryption,
  );

  return {
    async load(): Promise<{
      session: SavedSession;
      persistence: SessionPersistence;
    } | null> {
      const saved = await file.read();
      const session = saved && parseSavedSession(saved.value);

      if (!saved) {
        return null;
      }

      if (!session) {
        // Not written by this app.
        await file.remove();

        return null;
      }

      return {
        session,
        persistence: saved.encrypted ? 'encrypted' : 'unencrypted',
      };
    },

    /** Without a keyring, writes nothing and answers `ask` unless `evenUnencrypted`. */
    async save(
      session: SavedSession,
      evenUnencrypted = false,
    ): Promise<SessionPersistence> {
      if (!evenUnencrypted && !(await file.protects())) {
        return 'ask';
      }

      const written = await file.write(JSON.stringify(session));

      if (!written.persisted) {
        return 'failed';
      }

      return written.encrypted ? 'encrypted' : 'unencrypted';
    },

    /** Never throws: signing out must always work. */
    async clear() {
      try {
        await file.remove();
      } catch {
        // The next launch will find TMDB refusing it anyway.
      }
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
