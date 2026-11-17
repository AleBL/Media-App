import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The part of Electron's safeStorage that the stores use. */
export interface Encryption {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  encryptStringAsync(plainText: string): Promise<Buffer>;
  decryptStringAsync(
    encrypted: Buffer,
  ): Promise<{ result: string; shouldReEncrypt: boolean }>;
  /** Linux only: which password manager backs the encryption. */
  getSelectedStorageBackend?(): string;
}

export interface Persistence {
  /** Saved on disk, not only in memory. */
  persisted: boolean;
  /** Encrypted by the system keyring. */
  encrypted: boolean;
}

export const NOT_PERSISTED: Persistence = {
  persisted: false,
  encrypted: false,
};

/**
 * A secret of the user saved in `directory`: encrypted by the OS when it can,
 * otherwise as plain text (some Linux setups have no keyring). Both files are
 * readable by the user only.
 *
 * Electron's Linux `basic_text` backend encrypts with a password that is the
 * same on every machine, so it counts as unencrypted.
 */
export function createSecretFile(
  directory: string,
  names: { encrypted: string; plain: string },
  encryption: Encryption,
) {
  const encryptedFile = join(directory, names.encrypted);
  const plainFile = join(directory, names.plain);

  async function canEncrypt() {
    try {
      return await encryption.isAsyncEncryptionAvailable();
    } catch {
      return false;
    }
  }

  const isProtected = () =>
    encryption.getSelectedStorageBackend?.() !== 'basic_text';

  /** Never throws. */
  async function write(value: string): Promise<Persistence> {
    try {
      await mkdir(directory, { recursive: true });

      if (await canEncrypt()) {
        await writeFile(
          encryptedFile,
          await encryption.encryptStringAsync(value),
          { mode: 0o600 },
        );
        await rm(plainFile, { force: true });

        return { persisted: true, encrypted: isProtected() };
      }

      await writeFile(plainFile, value, { mode: 0o600 });
      await rm(encryptedFile, { force: true });

      return { persisted: true, encrypted: false };
    } catch {
      return NOT_PERSISTED;
    }
  }

  async function readEncrypted() {
    try {
      const { result, shouldReEncrypt } = await encryption.decryptStringAsync(
        await readFile(encryptedFile),
      );

      return { value: result, stale: shouldReEncrypt };
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
    /** Whether a value written now would be encrypted by a keyring. */
    async protects() {
      return (await canEncrypt()) && isProtected();
    },

    write,

    async read(): Promise<(Persistence & { value: string }) | null> {
      const decrypted = (await canEncrypt()) ? await readEncrypted() : null;

      if (decrypted) {
        return {
          value: decrypted.value,
          // The OS rotated its key: encrypt again.
          ...(decrypted.stale
            ? await write(decrypted.value)
            : { persisted: true, encrypted: isProtected() }),
        };
      }

      const plain = await readPlain();

      // Rewriting encrypts it if a keyring appeared since it was saved.
      return plain ? { value: plain, ...(await write(plain)) } : null;
    },

    async remove() {
      await rm(encryptedFile, { force: true });
      await rm(plainFile, { force: true });
    },
  };
}

export type SecretFile = ReturnType<typeof createSecretFile>;
