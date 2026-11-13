import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CredentialStatus } from '../../../shared/api';

/** The part of Electron's safeStorage that the store uses. */
export interface Encryption {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  encryptStringAsync(plainText: string): Promise<Buffer>;
  decryptStringAsync(
    encrypted: Buffer,
  ): Promise<{ result: string; shouldReEncrypt: boolean }>;
  /** Linux only: which password manager backs the encryption. */
  getSelectedStorageBackend?(): string;
}

export const ENCRYPTED_FILE = 'tmdb-credential.bin';
export const PLAIN_FILE = 'tmdb-credential.txt';

/**
 * Keeps the TMDB key in the main process and on disk, inside `directory`.
 *
 * The key is encrypted by the operating system when it can do that. A
 * system without a keyring (some Linux setups) keeps it as plain text in a
 * file only the user can read, which is what older versions of the app did
 * in localStorage. The status tells which of the two happened.
 *
 * On Linux, Electron may answer that it can encrypt while using a password
 * that is the same on every machine (the `basic_text` backend). That hides
 * the key but does not protect it, so the status reports it as unencrypted.
 */
export function createCredentialStore(
  directory: string,
  encryption: Encryption,
) {
  const encryptedFile = join(directory, ENCRYPTED_FILE);
  const plainFile = join(directory, PLAIN_FILE);

  let key: string | null = null;
  let persisted = false;
  let encrypted = false;

  const status = (): CredentialStatus => ({
    hasKey: key !== null,
    persisted,
    encrypted,
  });

  async function canEncrypt() {
    try {
      return await encryption.isAsyncEncryptionAvailable();
    } catch {
      return false;
    }
  }

  const isProtected = () =>
    encryption.getSelectedStorageBackend?.() !== 'basic_text';

  async function write(apiKey: string) {
    persisted = false;
    encrypted = false;

    try {
      await mkdir(directory, { recursive: true });

      if (await canEncrypt()) {
        await writeFile(
          encryptedFile,
          await encryption.encryptStringAsync(apiKey),
          { mode: 0o600 },
        );
        await rm(plainFile, { force: true });
        encrypted = isProtected();
      } else {
        await writeFile(plainFile, apiKey, { mode: 0o600 });
        await rm(encryptedFile, { force: true });
      }

      persisted = true;
    } catch {
      // The key still works until the app closes.
    }
  }

  async function readEncrypted() {
    try {
      const { result, shouldReEncrypt } = await encryption.decryptStringAsync(
        await readFile(encryptedFile),
      );

      return { apiKey: result, stale: shouldReEncrypt };
    } catch {
      // No file, or one that can no longer be decrypted.
      return null;
    }
  }

  async function readPlain() {
    try {
      return (await readFile(plainFile, 'utf8')).trim() || null;
    } catch {
      return null;
    }
  }

  return {
    get: () => key,
    status,

    /** Reads the key saved by a previous launch, if there is one. */
    async load() {
      key = null;
      persisted = false;
      encrypted = false;

      const sealed = (await canEncrypt()) ? await readEncrypted() : null;

      if (sealed) {
        key = sealed.apiKey;
        persisted = true;
        encrypted = isProtected();

        // The operating system rotated its key: seal the value again.
        if (sealed.stale) {
          await write(sealed.apiKey);
        }

        return status();
      }

      const plain = await readPlain();

      if (plain) {
        key = plain;
        // Encrypts it now if the system gained a keyring since it was saved.
        await write(plain);
      }

      return status();
    },

    async save(apiKey: string) {
      key = apiKey;
      await write(apiKey);

      return status();
    },

    async clear() {
      key = null;
      persisted = false;
      encrypted = false;
      await rm(encryptedFile, { force: true });
      await rm(plainFile, { force: true });

      return status();
    },
  };
}

export type CredentialStore = ReturnType<typeof createCredentialStore>;
