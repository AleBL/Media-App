import { vi } from 'vitest';
import type {
  Account,
  CredentialStatus,
  DiscoverFilters,
  MediaAppApi,
  MediaDetails,
  MediaItem,
  Paged,
  PersonDetails,
  SeasonDetails,
  SearchItem,
  SessionPersistence,
  SessionState,
  WatchProvider,
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

/** The page of a person with everything filled in. */
/** The page of a tv show with its seasons, the specials last. */
export const BREAKING_BAD: MediaDetails = {
  type: 'tv',
  id: 1396,
  title: 'Breaking Bad',
  overview: 'A chemistry teacher turns to making meth.',
  date: '2008-01-20',
  runtime: 47,
  seasons: 5,
  episodes: 62,
  genres: [{ id: 18, name: 'Drama' }],
  posterPath: '/bb.jpg',
  voteAverage: 8.9,
  voteCount: 15000,
  cast: [{ id: 17419, name: 'Bryan Cranston', character: 'Walter White' }],
  seasonList: [
    {
      number: 1,
      name: 'Season 1',
      episodeCount: 7,
      airDate: '2008-01-20',
      posterPath: '/s1.jpg',
    },
    { number: 2, name: 'Season 2', episodeCount: 13, airDate: '2009-03-08' },
    { number: 0, name: 'Specials', episodeCount: 9, airDate: '2009-02-17' },
  ],
  lastEpisode: {
    season: 5,
    number: 16,
    name: 'Felina',
    airDate: '2013-09-29',
  },
};

/** The first season of BREAKING_BAD, one synopsis only in English. */
export const SEASON_ONE: SeasonDetails = {
  showId: 1396,
  number: 1,
  name: 'Season 1',
  overview: 'High school chemistry teacher Walter White learns he is ill.',
  airDate: '2008-01-20',
  posterPath: '/s1.jpg',
  episodes: [
    {
      number: 1,
      name: 'Pilot',
      overview: 'Walter White gets a diagnosis.',
      airDate: '2008-01-20',
      runtime: 59,
      stillPath: '/e1.jpg',
      voteAverage: 8.3,
    },
    {
      number: 2,
      name: "Cat's in the Bag...",
      overview: 'Walt and Jesse clean up.',
      overviewLanguage: 'en',
      airDate: '2008-01-27',
      runtime: 49,
    },
    {
      number: 7,
      name: 'A No-Rough-Stuff-Type Deal',
      airDate: '2008-03-09',
      runtime: 48,
      finale: true,
    },
  ],
};

export const KEANU: PersonDetails = {
  id: 6384,
  name: 'Keanu Reeves',
  department: 'Acting',
  biography:
    'Keanu Charles Reeves is a Canadian actor.\n\nHe is known for The Matrix and John Wick.',
  birthday: '1964-09-02',
  placeOfBirth: 'Beirut, Lebanon',
  profilePath: '/keanu.jpg',
  links: { imdb: 'nm0000206', instagram: 'keanu.example' },
  cast: [
    {
      id: 603,
      media_type: 'movie',
      title: 'The Matrix',
      release_date: '1999-03-31',
      poster_path: '/matrix.jpg',
      vote_average: 8.2,
      character: 'Neo',
    },
    {
      id: 245891,
      media_type: 'movie',
      title: 'John Wick',
      release_date: '2014-10-22',
      vote_average: 7.4,
      character: 'John Wick',
    },
    {
      id: 1100,
      media_type: 'tv',
      name: 'Swedish Dicks',
      first_air_date: '2016-08-11',
      vote_average: 6,
      character: 'Tex',
    },
  ],
  crew: [
    {
      id: 186759,
      media_type: 'movie',
      title: 'Man of Tai Chi',
      release_date: '2013-07-04',
      departments: ['Directing'],
    },
  ],
};

const SERVICES: WatchProvider[] = [
  { id: 8, name: 'Netflix', logoPath: '/netflix.png' },
  { id: 119, name: 'Amazon Prime Video', logoPath: '/prime.png' },
  { id: 337, name: 'Disney Plus', logoPath: '/disney.png' },
  { id: 307, name: 'Globoplay' },
];

/** What the filters of the Explore page offer for movies in Brazil. */
export const MOVIE_FILTERS: DiscoverFilters = {
  genres: [
    { id: 28, name: 'Action' },
    { id: 35, name: 'Comedy' },
    { id: 18, name: 'Drama' },
  ],
  providers: SERVICES,
  ageRatings: ['L', '10', '12', '14', '16', '18'],
  languages: ['en', 'ja', 'ko', 'pt'],
};

/** The same for tv shows, which have genres of their own. */
export const TV_FILTERS: DiscoverFilters = {
  ...MOVIE_FILTERS,
  genres: [
    { id: 10759, name: 'Action & Adventure' },
    { id: 18, name: 'Drama' },
  ],
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
      person: vi.fn<MediaAppApi['tmdb']['person']>(async ({ id }) => ({
        ok: true,
        data: { ...KEANU, id },
      })),
      season: vi.fn<MediaAppApi['tmdb']['season']>(async ({ id, season }) => ({
        ok: true,
        data: { ...SEASON_ONE, showId: id, number: season },
      })),
      discover: vi.fn<MediaAppApi['tmdb']['discover']>(async () => ({
        ok: true,
        data: pageOf() as Paged<MediaItem>,
      })),
      discoverFilters: vi.fn<MediaAppApi['tmdb']['discoverFilters']>(
        async ({ type }) => ({
          ok: true,
          data: type === 'movie' ? MOVIE_FILTERS : TV_FILTERS,
        }),
      ),
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
