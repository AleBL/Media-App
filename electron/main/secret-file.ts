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

/** How a value is kept on disk. */
export interface Kept {
  /** It is saved for the next launch, not only kept in memory. */
  persisted: boolean;
  /** What is saved is encrypted by the keyring of the system. */
  encrypted: boolean;
}

export const NOT_KEPT: Kept = { persisted: false, encrypted: false };

/**
 * A value of the user kept in `directory` between launches, in one of two
 * files: `names.encrypted`, encrypted by the operating system when it can
 * do that, or `names.plain`, as plain text, on a system without a keyring
 * (some Linux setups). Both can only be read by the user.
 *
 * On Linux, Electron may answer that it can encrypt while using a password
 * that is the same on every machine (the `basic_text` backend). That hides
 * the value but does not protect it, so it counts as unencrypted.
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

  /** Saves `value`, encrypted when the system can. Never throws. */
  async function write(value: string): Promise<Kept> {
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
      return NOT_KEPT;
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
    /** Whether a value saved now would be encrypted by a keyring. */
    async protects() {
      return (await canEncrypt()) && isProtected();
    },

    write,

    /** The value saved by an earlier launch, if there is one. */
    async read(): Promise<(Kept & { value: string }) | null> {
      const sealed = (await canEncrypt()) ? await readEncrypted() : null;

      if (sealed) {
        return {
          value: sealed.value,
          // The operating system rotated its key: seal the value again.
          ...(sealed.stale
            ? await write(sealed.value)
            : { persisted: true, encrypted: isProtected() }),
        };
      }

      const plain = await readPlain();

      // Encrypts it now if the system gained a keyring since it was saved.
      return plain ? { value: plain, ...(await write(plain)) } : null;
    },

    async remove() {
      await rm(encryptedFile, { force: true });
      await rm(plainFile, { force: true });
    },
  };
}

export type SecretFile = ReturnType<typeof createSecretFile>;
