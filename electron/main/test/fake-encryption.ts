import type { Encryption } from '../secret-file';

/**
 * Stands in for Electron's safeStorage in tests: reversible, and never
 * equal to the plain text. `backend` is what Linux would report.
 */
export function fakeEncryption(
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
