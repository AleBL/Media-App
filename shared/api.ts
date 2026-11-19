// What the renderer can ask of whoever holds the TMDB credential: the main
// process on the desktop (through the preload, as `window.api`), or the
// site's functions in /api on the web (src/services/webApi.ts).

export const TMDB_PROXY_PATH = '/api/tmdb';

export const ACCOUNT_PATH = '/api/account';

export const AUTH_PATHS = {
  login: '/api/auth/login',
  callback: '/api/auth/callback',
  session: '/api/auth/session',
  logout: '/api/auth/logout',
} as const;

export type NativeTheme = 'system' | 'light' | 'dark';

export type MediaType = 'movie' | 'tv';

/** `multi` searches movies, tv shows and people at once. */
export type SearchType = MediaType | 'multi';

/** TMDB always answers searches with 20 results per page. */
export const TMDB_PAGE_SIZE = 20;

// Movies carry title/release_date, tv shows name/first_air_date.
export interface MediaItem {
  id: number;
  media_type?: MediaType;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  genre_ids?: number[];
  vote_average?: number;
  /** The synopsis, for the list view. */
  overview?: string;
  /** Only in the list of rated titles. */
  rating?: number;
  /** YYYY-MM-DD, only in the list of watched titles. */
  watchedAt?: string;
}

export interface PersonItem {
  id: number;
  media_type: 'person';
  name: string;
  profile_path?: string;
  known_for: MediaItem[];
}

export type SearchItem = MediaItem | PersonItem;

export interface Genre {
  id: number;
  name: string;
}

export interface Paged<T> {
  page: number;
  results: T[];
  totalPages: number;
  totalResults: number;
}

/** `language` is an app locale such as `en` or `pt-BR`, here and below. */
export interface SearchRequest {
  type: SearchType;
  query: string;
  page: number;
  language: string;
}

/** The lists of the home page. */
export type MediaList = 'trending' | 'popular-movies' | 'popular-tv';

export interface ListRequest {
  list: MediaList;
  language: string;
}

export interface DetailsRequest {
  type: MediaType;
  id: number;
  language: string;
  /** Country code such as `BR`, for where to watch. */
  region: string;
}

export interface TitleRequest {
  type: MediaType;
  id: number;
}

export type AccountList = 'watchlist' | 'favorite';

export type AccountStates = Record<AccountList, boolean>;

/** From 0.5 to 10, in steps of 0.5. */
export const RATINGS: readonly number[] = Array.from(
  { length: 20 },
  (_, step) => (step + 1) / 2,
);

export interface TitleStates extends AccountStates {
  /** One of RATINGS, or null when not rated. */
  rated: number | null;
}

/** `value: null` removes the rating. */
export interface RateRequest extends TitleRequest {
  value: number | null;
}

export type TitleList = AccountList | 'rated';

export interface MarkRequest extends TitleRequest {
  list: AccountList;
  value: boolean;
}

export interface AccountListRequest {
  list: TitleList;
  /** TMDB keeps the movies and the tv shows of a list apart. */
  type: MediaType;
  page: number;
  language: string;
}

export interface WatchedRequest extends TitleRequest {
  value: boolean;
  /** The user's local day, YYYY-MM-DD. */
  date: string;
  /** Names the list when it has to be created. */
  language: string;
}

export interface WatchedListRequest {
  page: number;
  language: string;
}

export interface CastMember {
  id: number;
  name: string;
  character?: string;
  profilePath?: string;
}

export interface WatchProvider {
  id: number;
  name: string;
  logoPath?: string;
}

/** From JustWatch, which must be credited wherever this is shown. */
export interface WatchOptions {
  /** The TMDB page that links to each provider. */
  link?: string;
  stream: WatchProvider[];
  /** Free, with or without ads. */
  free: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}

export interface MediaDetails {
  type: MediaType;
  id: number;
  title: string;
  /** Only when different from `title`. */
  originalTitle?: string;
  tagline?: string;
  overview?: string;
  /** YYYY-MM-DD: release of a movie, first episode of a tv show. */
  date?: string;
  /** Minutes: the movie, or an episode. */
  runtime?: number;
  seasons?: number;
  episodes?: number;
  genres: Genre[];
  posterPath?: string;
  /** A wide still of the title, behind the top of its page. */
  backdropPath?: string;
  voteAverage?: number;
  voteCount?: number;
  imdbId?: string;
  /** A YouTube video. */
  trailer?: { key: string; name: string };
  cast: CastMember[];
  watch?: WatchOptions;
  certification?: Certification;
}

/** An age rating, such as `14` in Brazil or `PG-13` in the United States. */
export interface Certification {
  /** Who gave it: the region of the request, or else the United States. */
  country: string;
  code: string;
}

export type TmdbErrorCode =
  | 'missing-credential'
  | 'unauthorized'
  | 'not-found'
  | 'rate-limited'
  | 'invalid-request'
  | 'server'
  | 'network'
  | 'timeout'
  /** Nobody is signed in, or the session is over. */
  | 'signed-out'
  /** Signed in without the user's v4 access token (or with a revoked one). */
  | 'sign-in-again';

export interface TmdbFailure {
  code: TmdbErrorCode;
  /** HTTP status, when TMDB answered. */
  status?: number;
  message?: string;
}

// Errors lose their fields over IPC, so failures are returned, not thrown.
export type Result<T> =
  { ok: true; data: T } | { ok: false; error: TmdbFailure };

export interface CredentialStatus {
  /** The user saved a TMDB key of their own. */
  hasKey: boolean;
  /** Saved on disk, not only in memory. */
  persisted: boolean;
  /** Encrypted by the system keyring. */
  encrypted: boolean;
  /** The app was built with its own TMDB credential. */
  builtIn: boolean;
}

export interface Account {
  id: number;
  username: string;
  name?: string;
  avatarPath?: string;
}

export type LoginFailure =
  /** Refused on the TMDB website. */
  | 'denied'
  | 'timeout'
  | 'network'
  /** TMDB would not start or finish the login. */
  | 'unavailable';

// The session_id works as a password, so it never reaches the renderer.
export type SessionState =
  | { status: 'anonymous' }
  | {
      /** Waiting for the user to approve on the TMDB website. */
      status: 'pending';
      /** Epoch milliseconds. */
      expiresAt: number;
      /** For a browser that did not open by itself. */
      authorizeUrl: string;
    }
  | {
      status: 'authenticated';
      account: Account;
      /** Desktop only. */
      persistence?: SessionPersistence;
      /**
       * Desktop only: TMDB could not confirm the saved session at launch.
       * The user stays signed in and the app checks again later.
       */
      offline?: boolean;
    }
  | { status: 'error'; reason: LoginFailure };

/** How the desktop app saves the session for the next launch. */
export type SessionPersistence =
  | 'encrypted'
  /** No keyring, and the user agreed to save it anyway. */
  | 'unencrypted'
  /** No keyring: kept in memory until the user agrees (`auth.remember()`). */
  | 'ask'
  /** Could not be written: lasts until the app closes. */
  | 'failed';

/** A newer version on GitHub Releases. Always `idle` on the web and in development. */
export type UpdateState =
  | { status: 'idle' }
  /** This copy cannot replace itself: the user downloads it from `url`. */
  | { status: 'available'; version: string; url: string }
  | { status: 'downloading'; version: string }
  /** Downloaded: installed on restart, or when the app closes. */
  | { status: 'ready'; version: string };

export interface MediaAppApi {
  platform: 'desktop' | 'web';
  /** Desktop only. */
  versions?: {
    electron: string;
    node: string;
    chrome: string;
  };
  /** Makes the window chrome and `prefers-color-scheme` follow the app. */
  setNativeTheme(theme: NativeTheme): void;
  tmdb: {
    search(request: SearchRequest): Promise<Result<Paged<SearchItem>>>;
    genres(language: string): Promise<Result<Genre[]>>;
    details(request: DetailsRequest): Promise<Result<MediaDetails>>;
    /** The first page of a list, each title tagged with its type. */
    list(request: ListRequest): Promise<Result<MediaItem[]>>;
    /** Country codes with watch providers, such as `BR`, sorted. */
    regions(): Promise<Result<string[]>>;
  };
  /** Forgets cached genres and images. Does nothing on the web. */
  clearCache(): Promise<Result<null>>;
  /** Fails with `signed-out` when nobody is signed in. */
  account: {
    states(request: TitleRequest): Promise<Result<TitleStates>>;
    mark(request: MarkRequest): Promise<Result<null>>;
    rate(request: RateRequest): Promise<Result<null>>;
    /** Last added (or rated) first. */
    list(request: AccountListRequest): Promise<Result<Paged<MediaItem>>>;
  };
  /**
   * Kept in a private v4 list of the user, created on the first mark. Fails
   * with `signed-out`, or `sign-in-again` without the user's access token.
   */
  watched: {
    state(request: TitleRequest): Promise<Result<boolean>>;
    mark(request: WatchedRequest): Promise<Result<null>>;
    list(request: WatchedListRequest): Promise<Result<Paged<MediaItem>>>;
  };
  /** A saved key is never sent back to the renderer. */
  credentials: {
    status(): Promise<CredentialStatus>;
    save(apiKey: string): Promise<CredentialStatus>;
    clear(): Promise<CredentialStatus>;
  };
  /** Optional: searching never needs it. Approval happens on the TMDB website. */
  auth: {
    getSession(): Promise<SessionState>;
    /**
     * Desktop: opens the approval page and answers `pending`; the result
     * comes through `onChange`. Web: the page itself goes to TMDB and back.
     */
    login(language: string): Promise<SessionState>;
    /** Asks TMDB whether the user approved, when the browser did not return. */
    confirmManual(): Promise<SessionState>;
    /** Cancels a pending login, or dismisses a failed one. */
    cancelLogin(): Promise<SessionState>;
    logout(): Promise<SessionState>;
    /** Saves the session unencrypted once the user agreed (`persistence: 'ask'`). */
    remember(): Promise<SessionState>;
    /** Returns a function that stops listening. */
    onChange(listener: (state: SessionState) => void): () => void;
  };
  updates: {
    state(): Promise<UpdateState>;
    /** Restarts into the downloaded version (status `ready`). */
    install(): Promise<void>;
    /** Returns a function that stops listening. */
    onChange(listener: (state: UpdateState) => void): () => void;
  };
}

export const IPC = {
  setNativeTheme: 'theme:set-native',
  tmdbSearch: 'tmdb:search',
  tmdbGenres: 'tmdb:genres',
  tmdbDetails: 'tmdb:details',
  tmdbList: 'tmdb:list',
  tmdbRegions: 'tmdb:regions',
  clearCache: 'app:clear-cache',
  accountStates: 'account:states',
  accountMark: 'account:mark',
  accountRate: 'account:rate',
  accountList: 'account:list',
  watchedState: 'watched:state',
  watchedMark: 'watched:mark',
  watchedList: 'watched:list',
  credentialStatus: 'credentials:status',
  credentialSave: 'credentials:save',
  credentialClear: 'credentials:clear',
  authSession: 'auth:session',
  authLogin: 'auth:login',
  authConfirm: 'auth:confirm',
  authCancel: 'auth:cancel',
  authLogout: 'auth:logout',
  authRemember: 'auth:remember',
  updatesState: 'updates:state',
  updatesInstall: 'updates:install',
} as const;

/** Sent by the main process without being asked. */
export const IPC_EVENTS = {
  authChanged: 'auth:changed',
  updatesChanged: 'updates:changed',
} as const;
