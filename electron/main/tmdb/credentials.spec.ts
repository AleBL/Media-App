// @vitest-environment node
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createCredentialStore,
  ENCRYPTED_FILE,
  PLAIN_FILE,
  type Encryption,
} from './credentials';

const KEY = '0123456789abcdef0123456789abcdef';
const NONE = { hasKey: false, persisted: false, encrypted: false };
const ENCRYPTED = { hasKey: true, persisted: true, encrypted: true };
const PLAIN = { hasKey: true, persisted: true, encrypted: false };

// Stands in for safeStorage: reversible, and never equal to the plain text.
function fakeEncryption(
  options: {
    available?: boolean;
    shouldReEncrypt?: boolean;
    backend?: string;
  } = {},
): Encryption & { encryptions: number } {
  return {
    encryptions: 0,
    getSelectedStorageBackend: () => options.backend ?? 'gnome_libsecret',
    isAsyncEncryptionAvailable: async () => options.available ?? true,
    async encryptStringAsync(text) {
      this.encryptions += 1;

      return Buffer.from(`sealed:${text}`).reverse();
    },
    async decryptStringAsync(sealed) {
      const text = Buffer.from(sealed).reverse().toString();

      if (!text.startsWith('sealed:')) throw new Error('cannot decrypt');

      return {
        result: text.slice('sealed:'.length),
        shouldReEncrypt: options.shouldReEncrypt ?? false,
      };
    },
  };
}

describe('credential store', () => {
  let root: string;
  let directory: string;
  let encryptedFile: string;
  let plainFile: string;

  const missing = (file: string) =>
    expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'media-app-credential-'));
    directory = join(root, 'profile');
    encryptedFile = join(directory, ENCRYPTED_FILE);
    plainFile = join(directory, PLAIN_FILE);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('starts without a key', async () => {
    const store = createCredentialStore(directory, fakeEncryption());

    expect(await store.load()).toEqual(NONE);
    expect(store.get()).toBeNull();
  });

  describe('with a system keyring', () => {
    it('saves the key encrypted and reads it back on the next launch', async () => {
      const first = createCredentialStore(directory, fakeEncryption());

      expect(await first.save(KEY)).toEqual(ENCRYPTED);
      expect((await readFile(encryptedFile)).toString()).not.toContain(KEY);
      await missing(plainFile);

      const second = createCredentialStore(directory, fakeEncryption());

      expect(await second.load()).toEqual(ENCRYPTED);
      expect(second.get()).toBe(KEY);
    });

    it('seals the key again when the system rotated its own key', async () => {
      await createCredentialStore(directory, fakeEncryption()).save(KEY);
      const rotated = fakeEncryption({ shouldReEncrypt: true });

      const store = createCredentialStore(directory, rotated);

      expect(await store.load()).toEqual(ENCRYPTED);
      expect(rotated.encryptions).toBe(1);
    });

    it('ignores a file that can no longer be decrypted', async () => {
      await createCredentialStore(directory, fakeEncryption()).save(KEY);
      await writeFile(encryptedFile, 'garbage');

      const store = createCredentialStore(directory, fakeEncryption());

      expect(await store.load()).toEqual(NONE);
    });
  });

  describe('with the password every machine shares (basic_text)', () => {
    const basicText = () => fakeEncryption({ backend: 'basic_text' });

    it('saves the key but does not call it encrypted', async () => {
      const first = createCredentialStore(directory, basicText());

      expect(await first.save(KEY)).toEqual(PLAIN);
      expect((await readFile(encryptedFile)).toString()).not.toContain(KEY);

      const second = createCredentialStore(directory, basicText());

      expect(await second.load()).toEqual(PLAIN);
      expect(second.get()).toBe(KEY);
    });
  });

  describe('without a system keyring', () => {
    const noKeyring = () => fakeEncryption({ available: false });

    it('keeps the key as plain text and says so', async () => {
      const first = createCredentialStore(directory, noKeyring());

      expect(await first.save(KEY)).toEqual(PLAIN);
      expect(await readFile(plainFile, 'utf8')).toBe(KEY);
      await missing(encryptedFile);

      const second = createCredentialStore(directory, noKeyring());

      expect(await second.load()).toEqual(PLAIN);
      expect(second.get()).toBe(KEY);
    });

    it('encrypts the key once a keyring becomes available', async () => {
      await createCredentialStore(directory, noKeyring()).save(KEY);

      const store = createCredentialStore(directory, fakeEncryption());

      expect(await store.load()).toEqual(ENCRYPTED);
      expect(store.get()).toBe(KEY);
      await missing(plainFile);
    });
  });

  it.skipIf(process.platform === 'win32')(
    'keeps the files readable by the owner only',
    async () => {
      await createCredentialStore(directory, fakeEncryption()).save(KEY);
      expect((await stat(encryptedFile)).mode & 0o777).toBe(0o600);

      await createCredentialStore(
        directory,
        fakeEncryption({ available: false }),
      ).save(KEY);
      expect((await stat(plainFile)).mode & 0o777).toBe(0o600);
    },
  );

  it('removes the key and its files', async () => {
    const store = createCredentialStore(directory, fakeEncryption());
    await store.save(KEY);

    expect(await store.clear()).toEqual(NONE);
    expect(store.get()).toBeNull();
    await missing(encryptedFile);
    await missing(plainFile);
  });

  it('keeps the key for this session when it cannot be written', async () => {
    // A file where the profile folder should be makes every write fail.
    await writeFile(directory, 'not a folder');
    const store = createCredentialStore(directory, fakeEncryption());

    expect(await store.save(KEY)).toEqual({
      hasKey: true,
      persisted: false,
      encrypted: false,
    });
    expect(store.get()).toBe(KEY);
  });
});
