import { vi } from 'vitest';
import type {
  Account,
  CredentialStatus,
  MediaAppApi,
  MediaDetails,
  MediaItem,
  Paged,
  SearchItem,
  SessionPersistence,
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
const ADA: Account = { id: 7, username: 'ada', name: 'Ada Lovelace' };
export const SIGNED_IN: SessionState = {
  status: 'authenticated',
  account: ADA,
};

/** Signed in on the desktop, which also tells how the session is kept. */
export const signedInOnDesktop = (
  persistence: SessionPersistence,
  offline = false,
): SessionState => ({
  status: 'authenticated',
  account: ADA,
  persistence,
  offline,
});

/** The page of a movie with everything filled in. */
export const MATRIX: MediaDetails = {
  type: 'movie',
  id: 603,
  title: 'Matrix',
  originalTitle: 'The Matrix',
  tagline: 'Welcome to the Real World.',
  overview: 'A hacker learns the truth about his reality.',
  date: '1999-03-31',
  runtime: 136,
  genres: [
    { id: 28, name: 'Action' },
    { id: 878, name: 'Science Fiction' },
  ],
  posterPath: '/matrix.jpg',
  voteAverage: 8.2,
  voteCount: 26000,
  imdbId: 'tt0133093',
  trailer: { key: 'vKQi3bBA1y8', name: 'Official Trailer' },
  cast: [
    { id: 6384, name: 'Keanu Reeves', character: 'Neo', profilePath: '/k.jpg' },
    { id: 2975, name: 'Laurence Fishburne', character: 'Morpheus' },
  ],
  watch: {
    link: 'https://www.themoviedb.org/movie/603-the-matrix/watch?locale=US',
    stream: [{ id: 8, name: 'Netflix', logoPath: '/netflix.png' }],
    free: [],
    rent: [{ id: 2, name: 'Apple TV' }],
    buy: [],
  },
  certification: { country: 'US', code: 'R' },
};

export function pageOf(
  results: SearchItem[] = [],
  overrides: Partial<Paged<SearchItem>> = {},
): Paged<SearchItem> {
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
    clearCache: vi.fn<MediaAppApi['clearCache']>(async () => ({
      ok: true,
      data: null,
    })),
    tmdb: {
      search: vi.fn<MediaAppApi['tmdb']['search']>(async () => ({
        ok: true,
        data: pageOf(),
      })),
      genres: vi.fn<MediaAppApi['tmdb']['genres']>(async () => ({
        ok: true,
        data: [],
      })),
      details: vi.fn<MediaAppApi['tmdb']['details']>(async ({ type, id }) => ({
        ok: true,
        data: { ...MATRIX, type, id },
      })),
      list: vi.fn<MediaAppApi['tmdb']['list']>(async () => ({
        ok: true,
        data: [],
      })),
      regions: vi.fn<MediaAppApi['tmdb']['regions']>(async () => ({
        ok: true,
        data: ['BR', 'DE', 'PT', 'US'],
      })),
    },
    // An account with nothing in its lists, nothing rated, and changes that
    // go through.
    account: {
      states: vi.fn<MediaAppApi['account']['states']>(async () => ({
        ok: true,
        data: { watchlist: false, favorite: false, rated: null },
      })),
      mark: vi.fn<MediaAppApi['account']['mark']>(async () => ({
        ok: true,
        data: null,
      })),
      rate: vi.fn<MediaAppApi['account']['rate']>(async () => ({
        ok: true,
        data: null,
      })),
      list: vi.fn<MediaAppApi['account']['list']>(async () => ({
        ok: true,
        data: pageOf() as Paged<MediaItem>,
      })),
    },
    // Nothing watched yet, and marks that go through.
    watched: {
      state: vi.fn<MediaAppApi['watched']['state']>(async () => ({
        ok: true,
        data: false,
      })),
      mark: vi.fn<MediaAppApi['watched']['mark']>(async () => ({
        ok: true,
        data: null,
      })),
      list: vi.fn<MediaAppApi['watched']['list']>(async () => ({
        ok: true,
        data: pageOf() as Paged<MediaItem>,
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
      remember: vi.fn<MediaAppApi['auth']['remember']>(async () => SIGNED_IN),
      // The listener is in `onChange.mock.calls`, for a test to call it the
      // way the main process does.
      onChange: vi.fn<MediaAppApi['auth']['onChange']>(() => () => {}),
    },
    updates: {
      state: vi.fn<MediaAppApi['updates']['state']>(async () => ({
        status: 'idle',
      })),
      install: vi.fn<MediaAppApi['updates']['install']>(async () => {}),
      onChange: vi.fn<MediaAppApi['updates']['onChange']>(() => () => {}),
    },
  } satisfies MediaAppApi;

  window.api = api;

  return api;
}
