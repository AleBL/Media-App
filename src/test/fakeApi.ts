import { vi } from 'vitest';
import type {
  CredentialStatus,
  MediaAppApi,
  MediaItem,
  Paged,
  SessionState,
} from '@shared/api';

/** The usual case: the app has its own credential and the user saved no key. */
export const NO_KEY: CredentialStatus = {
  hasKey: false,
  persisted: false,
  encrypted: false,
  builtIn: true,
};
export const SAVED_KEY: CredentialStatus = {
  hasKey: true,
  persisted: true,
  encrypted: true,
  builtIn: true,
};
/** An app built without a credential, before the user saves a key. */
export const NO_ACCESS: CredentialStatus = { ...NO_KEY, builtIn: false };

export const ANONYMOUS: SessionState = { status: 'anonymous' };
/** A login waiting for the approval on the TMDB website. */
export const PENDING: SessionState = {
  status: 'pending',
  expiresAt: 1_800_000_000_000,
  authorizeUrl:
    'https://www.themoviedb.org/authenticate/a1b2c3?redirect_to=http%3A%2F%2F127.0.0.1%3A50000%2Fcallback',
};
export const SIGNED_IN: SessionState = {
  status: 'authenticated',
  account: { id: 7, username: 'ada', name: 'Ada Lovelace' },
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
    platform: 'desktop' as MediaAppApi['platform'],
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
    // A login that goes well: approval asked, then confirmed.
    auth: {
      getSession: vi.fn<MediaAppApi['auth']['getSession']>(
        async () => ANONYMOUS,
      ),
      login: vi.fn<MediaAppApi['auth']['login']>(async () => PENDING),
      confirmManual: vi.fn<MediaAppApi['auth']['confirmManual']>(
        async () => SIGNED_IN,
      ),
      cancelLogin: vi.fn<MediaAppApi['auth']['cancelLogin']>(
        async () => ANONYMOUS,
      ),
      logout: vi.fn<MediaAppApi['auth']['logout']>(async () => ANONYMOUS),
      // The listener is in `onChange.mock.calls`, for a test to call it the
      // way the main process does.
      onChange: vi.fn<MediaAppApi['auth']['onChange']>(() => () => {}),
    },
  } satisfies MediaAppApi;

  window.api = api;

  return api;
}
