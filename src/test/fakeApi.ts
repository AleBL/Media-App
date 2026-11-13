import { vi } from 'vitest';
import type {
  CredentialStatus,
  MediaAppApi,
  MediaItem,
  Paged,
} from '@shared/api';

export const NO_KEY: CredentialStatus = {
  hasKey: false,
  persisted: false,
  encrypted: false,
};
export const SAVED_KEY: CredentialStatus = {
  hasKey: true,
  persisted: true,
  encrypted: true,
};

export function pageOf(
  results: MediaItem[] = [],
  overrides: Partial<Paged<MediaItem>> = {},
): Paged<MediaItem> {
  return {
    page: 1,
    results,
    totalPages: 1,
    totalResults: results.length,
    ...overrides,
  };
}

/**
 * Puts a stand-in for the preload API on `window.api`, the way the preload
 * script does in the real app. Every method is a mock that can be inspected
 * or given another answer.
 */
export function installFakeApi() {
  const api = {
    versions: { electron: '45.0.0', node: '24.0.0', chrome: '156.0.0' },
    setNativeTheme: vi.fn<MediaAppApi['setNativeTheme']>(),
    tmdb: {
      search: vi.fn<MediaAppApi['tmdb']['search']>(async () => ({
        ok: true,
        data: pageOf(),
      })),
      genres: vi.fn<MediaAppApi['tmdb']['genres']>(async () => ({
        ok: true,
        data: [],
      })),
    },
    credentials: {
      status: vi.fn<MediaAppApi['credentials']['status']>(async () => NO_KEY),
      save: vi.fn<MediaAppApi['credentials']['save']>(async () => SAVED_KEY),
      clear: vi.fn<MediaAppApi['credentials']['clear']>(async () => NO_KEY),
    },
  } satisfies MediaAppApi;

  window.api = api;

  return api;
}
