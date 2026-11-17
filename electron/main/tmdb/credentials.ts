import type { CredentialStatus } from '../../../shared/api';
import {
  createSecretFile,
  NOT_PERSISTED,
  type Encryption,
  type Persistence,
} from '../secret-file';

export type { Encryption };

export const ENCRYPTED_FILE = 'tmdb-credential.bin';
export const PLAIN_FILE = 'tmdb-credential.txt';

/**
 * Which credential TMDB requests use: the user's own key when saved,
 * otherwise `appCredential` (built into the app, empty when there is none).
 * The key stays in the main process and on disk.
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
  let persistence: Persistence = NOT_PERSISTED;

  const status = (): CredentialStatus => ({
    hasKey: key !== null,
    persisted: persistence.persisted,
    encrypted: persistence.encrypted,
    builtIn: builtIn !== null,
  });

  return {
    get: () => key ?? builtIn,
    status,

    async load() {
      key = null;
      persistence = NOT_PERSISTED;

      const saved = await file.read();

      if (saved) {
        const { value, ...savedPersistence } = saved;

        key = value;
        persistence = savedPersistence;
      }

      return status();
    },

    // If it cannot be written, the key still works until the app closes.
    async save(apiKey: string) {
      key = apiKey;
      persistence = NOT_PERSISTED;
      persistence = await file.write(apiKey);

      return status();
    },

    async clear() {
      key = null;
      persistence = NOT_PERSISTED;
      await file.remove();

      return status();
    },
  };
}

export type CredentialStore = ReturnType<typeof createCredentialStore>;
