// @vitest-environment node
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeEncryption } from '../test/fake-encryption';
import {
  createSessionStore,
  ENCRYPTED_FILE,
  PLAIN_FILE,
  type SavedSession,
} from './session-store';

const SESSION: SavedSession = {
  sessionId: '0123456789abcdef0123456789abcdef01234567',
  account: { id: 7, username: 'ada', name: 'Ada Lovelace' },
};
// What the v4 login gives besides the session.
const V4 = {
  accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.dXNlcg',
  accountObjectId: '5f0c4a1b2c3d4e5f6a7b8c9d',
};

describe('session store', () => {
  let root: string;
  let directory: string;
  let encryptedFile: string;
  let plainFile: string;

  const missing = (file: string) =>
    expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'media-app-session-'));
    directory = join(root, 'profile');
    encryptedFile = join(directory, ENCRYPTED_FILE);
    plainFile = join(directory, PLAIN_FILE);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('has nothing before a session is saved', async () => {
    await expect(
      createSessionStore(directory, fakeEncryption()).load(),
    ).resolves.toBeNull();
  });

  describe('with a system keyring', () => {
    it('keeps the session encrypted, in a file only the user can read', async () => {
      const store = createSessionStore(directory, fakeEncryption());

      await expect(store.save(SESSION)).resolves.toBe('encrypted');

      const sealed = await readFile(encryptedFile);
      expect(sealed.toString()).not.toContain(SESSION.sessionId);
      if (process.platform !== 'win32') {
        expect((await stat(encryptedFile)).mode & 0o777).toBe(0o600);
      }
      await missing(plainFile);
    });

    it('gives the next launch the session and who it is', async () => {
      await createSessionStore(directory, fakeEncryption()).save(SESSION);

      await expect(
        createSessionStore(directory, fakeEncryption()).load(),
      ).resolves.toEqual({ session: SESSION, kept: 'encrypted' });
    });

    it('keeps the access of the user of the v4 login too, encrypted', async () => {
      const store = createSessionStore(directory, fakeEncryption());

      await store.save({ ...SESSION, ...V4 });

      expect((await readFile(encryptedFile)).toString()).not.toContain(
        V4.accessToken,
      );
      await expect(
        createSessionStore(directory, fakeEncryption()).load(),
      ).resolves.toEqual({ session: { ...SESSION, ...V4 }, kept: 'encrypted' });
    });

    it('encrypts a session saved when the system had no keyring', async () => {
      await createSessionStore(
        directory,
        fakeEncryption({ available: false }),
      ).save(SESSION, true);

      await expect(
        createSessionStore(directory, fakeEncryption()).load(),
      ).resolves.toEqual({ session: SESSION, kept: 'encrypted' });
      await missing(plainFile);
    });
  });

  describe.each([
    ['without a system keyring', { available: false }, PLAIN_FILE],
    [
      'with the password every machine shares (basic_text)',
      { backend: 'basic_text' },
      ENCRYPTED_FILE,
    ],
  ])('%s', (_, options, written) => {
    it('saves nothing unless the user agrees', async () => {
      const store = createSessionStore(directory, fakeEncryption(options));

      await expect(store.save(SESSION)).resolves.toBe('ask');

      await missing(encryptedFile);
      await missing(plainFile);
    });

    it('keeps it unencrypted once the user agreed', async () => {
      const store = createSessionStore(directory, fakeEncryption(options));

      await expect(store.save(SESSION, true)).resolves.toBe('unencrypted');

      const file = join(directory, written);
      if (process.platform !== 'win32') {
        expect((await stat(file)).mode & 0o777).toBe(0o600);
      }
      await expect(
        createSessionStore(directory, fakeEncryption(options)).load(),
      ).resolves.toEqual({ session: SESSION, kept: 'unencrypted' });
    });
  });

  it('says so when the session cannot be written', async () => {
    // A file where the profile folder should be.
    await writeFile(directory, '');

    await expect(
      createSessionStore(directory, fakeEncryption()).save(SESSION),
    ).resolves.toBe('failed');
  });

  it('forgets the session', async () => {
    const store = createSessionStore(directory, fakeEncryption());
    await store.save(SESSION);

    await store.clear();

    await missing(encryptedFile);
    await expect(store.load()).resolves.toBeNull();
  });

  it('removes a file that holds no session', async () => {
    await createSessionStore(
      directory,
      fakeEncryption({ available: false }),
    ).save(SESSION, true);
    await writeFile(plainFile, '{"sessionId": 42}');

    await expect(
      createSessionStore(
        directory,
        fakeEncryption({ available: false }),
      ).load(),
    ).resolves.toBeNull();
    await missing(plainFile);
  });

  it('only gives back what it knows of the account', async () => {
    await createSessionStore(
      directory,
      fakeEncryption({ available: false }),
    ).save(SESSION, true);
    await writeFile(
      plainFile,
      JSON.stringify({
        ...SESSION,
        account: { id: 7, username: 'ada', avatarPath: '/a.png', admin: true },
      }),
    );

    await expect(
      createSessionStore(
        directory,
        fakeEncryption({ available: false }),
      ).load(),
    ).resolves.toEqual({
      session: {
        sessionId: SESSION.sessionId,
        account: { id: 7, username: 'ada', avatarPath: '/a.png' },
      },
      kept: 'unencrypted',
    });
  });

  it('drops half of the v4 access: one is of no use without the other', async () => {
    await createSessionStore(
      directory,
      fakeEncryption({ available: false }),
    ).save(SESSION, true);
    await writeFile(
      plainFile,
      JSON.stringify({ ...SESSION, accessToken: V4.accessToken }),
    );

    await expect(
      createSessionStore(
        directory,
        fakeEncryption({ available: false }),
      ).load(),
    ).resolves.toEqual({ session: SESSION, kept: 'unencrypted' });
  });
});
