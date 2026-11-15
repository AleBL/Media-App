import type { CredentialStatus } from '../../../shared/api';
import {
  createSecretFile,
  NOT_KEPT,
  type Encryption,
  type Kept,
} from '../secret-file';

export type { Encryption };

export const ENCRYPTED_FILE = 'tmdb-credential.bin';
export const PLAIN_FILE = 'tmdb-credential.txt';

/**
 * Decides which TMDB credential the requests use, and keeps the user's own
 * key in the main process and on disk, inside `directory`.
 *
 * `appCredential` is the one the app was built with (empty when there is
 * none). It is enough to search, so a key of the user is optional: when one
 * is saved it is used instead, which keeps the app working if the app's
 * credential is ever revoked.
 *
 * The key is encrypted by the operating system when it can do that. A
 * system without a keyring (some Linux setups) keeps it as plain text in a
 * file only the user can read, which is what older versions of the app did
 * in localStorage. The status tells which of the two happened.
 */
export function createCredentialStore(
  directory: string,
  encryption: Encryption,
  appCredential = '',
) {
  const file = createSecretFile(
    directory,
    { encrypted: ENCRYPTED_FILE, plain: PLAIN_FILE },
    encryption,
  );
  const builtIn = appCredential.trim() || null;

  let key: string | null = null;
  let kept: Kept = NOT_KEPT;

  const status = (): CredentialStatus => ({
    hasKey: key !== null,
    persisted: kept.persisted,
    encrypted: kept.encrypted,
    builtIn: builtIn !== null,
  });

  return {
    /** The user's key when there is one, otherwise the app's credential. */
    get: () => key ?? builtIn,
    status,

    /** Reads the key saved by a previous launch, if there is one. */
    async load() {
      key = null;
      kept = NOT_KEPT;

      const saved = await file.read();

      if (saved) {
        const { value, ...how } = saved;

        key = value;
        kept = how;
      }

      return status();
    },

    // When it cannot be written, the key still works until the app closes.
    async save(apiKey: string) {
      key = apiKey;
      kept = NOT_KEPT;
      kept = await file.write(apiKey);

      return status();
    },

    async clear() {
      key = null;
      kept = NOT_KEPT;
      await file.remove();

      return status();
    },
  };
}

export type CredentialStore = ReturnType<typeof createCredentialStore>;
