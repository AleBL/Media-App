import type { Account, SessionKeeping } from '../../../shared/api';
import { createSecretFile, type Encryption } from '../secret-file';

export const ENCRYPTED_FILE = 'tmdb-session.bin';
export const PLAIN_FILE = 'tmdb-session.txt';

/** What a launch leaves for the next one. */
export interface SavedSession {
  /** TMDB's session_id: whoever has it can act as the user. */
  sessionId: string;
  /** Who it is, to show while TMDB cannot be asked. */
  account: Account;
}

function parse(text: string): SavedSession | null {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  const { sessionId, account } = (value ?? {}) as Record<string, unknown>;
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

  return {
    sessionId,
    account: {
      id,
      username,
      ...(typeof name === 'string' ? { name } : {}),
      ...(typeof avatarPath === 'string' ? { avatarPath } : {}),
    },
  };
}

/**
 * Keeps the TMDB session of whoever signed in, so the next launch starts
 * signed in. It is a password of the account, so it is only saved when the
 * keyring of the system encrypts it, or when the user agreed to keep it
 * without that: on a system without a keyring, the app asks first.
 */
export function createSessionStore(directory: string, encryption: Encryption) {
  const file = createSecretFile(
    directory,
    { encrypted: ENCRYPTED_FILE, plain: PLAIN_FILE },
    encryption,
  );

  return {
    /** The session saved by an earlier launch, and how it is kept. */
    async load(): Promise<{
      session: SavedSession;
      kept: SessionKeeping;
    } | null> {
      const saved = await file.read();
      const session = saved && parse(saved.value);

      if (!saved) {
        return null;
      }

      if (!session) {
        // Not something this app wrote: nothing to sign in with.
        await file.remove();

        return null;
      }

      return { session, kept: saved.encrypted ? 'encrypted' : 'unencrypted' };
    },

    /**
     * Saves `session` for the next launch. Without a keyring nothing is
     * written, and the answer is `ask`, unless `evenUnencrypted`: the user
     * agreed to keep it like that.
     */
    async save(
      session: SavedSession,
      evenUnencrypted = false,
    ): Promise<SessionKeeping> {
      if (!evenUnencrypted && !(await file.protects())) {
        return 'ask';
      }

      const kept = await file.write(JSON.stringify(session));

      if (!kept.persisted) {
        return 'failed';
      }

      return kept.encrypted ? 'encrypted' : 'unencrypted';
    },

    /** Forgets the saved session. Never throws: signing out must work. */
    async clear() {
      try {
        await file.remove();
      } catch {
        // Nothing else to do: the next launch will find TMDB refusing it.
      }
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
