// What the renderer can ask of whoever holds the TMDB credential.
//
// In the desktop app that is the main process: the preload script exposes
// this API as `window.api`, and the renderer has no other Node or Electron
// access. On the web there is no preload script, and the same API is
// implemented over HTTP (src/services/webApi.ts) on top of functions of the
// site, which keep the credential and the session on the server (the files
// in /api).

/** Where the site answers TMDB requests for the web version of the app. */
export const TMDB_PROXY_PATH = '/api/tmdb';

/** Where the site answers the sign-in requests of the web version. */
export const AUTH_PATHS = {
  login: '/api/auth/login',
  callback: '/api/auth/callback',
  session: '/api/auth/session',
  logout: '/api/auth/logout',
} as const;

export type NativeTheme = 'system' | 'light' | 'dark';

export type MediaType = 'movie' | 'tv';

/** TMDB always answers searches with 20 results per page. */
export const TMDB_PAGE_SIZE = 20;

// A movie or tv show as returned by the TMDB search endpoints. Movies
// carry title/release_date, tv shows carry name/first_air_date.
export interface MediaItem {
  id: number;
  /** Which of the two it is: the type that was searched for. */
  media_type?: MediaType;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  genre_ids?: number[];
  vote_average?: number;
}

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

export interface SearchRequest {
  type: MediaType;
  query: string;
  page: number;
  /** An app locale such as `en` or `pt-BR`. */
  language: string;
}

export interface DetailsRequest {
  type: MediaType;
  id: number;
  /** An app locale such as `en` or `pt-BR`. */
  language: string;
  /** Where the user is, as a country code such as `BR`: for `watch`. */
  region: string;
}

/** Someone in the cast of a movie or tv show. */
export interface CastMember {
  id: number;
  name: string;
  character?: string;
  profilePath?: string;
}

/** A streaming service, store or channel. */
export interface WatchProvider {
  id: number;
  name: string;
  logoPath?: string;
}

/**
 * Where a title can be watched in one country, from JustWatch. Whoever
 * shows it must say that it comes from JustWatch.
 */
export interface WatchOptions {
  /** The page of TMDB with a link to each of the services. */
  link?: string;
  /** Included in a subscription. */
  stream: WatchProvider[];
  /** Free, with or without ads. */
  free: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}

/** What the page of a movie or tv show shows. */
export interface MediaDetails {
  type: MediaType;
  id: number;
  title: string;
  /** The title in its own language, when it is not the same. */
  originalTitle?: string;
  tagline?: string;
  overview?: string;
  /** YYYY-MM-DD: the release of a movie, the first episode of a tv show. */
  date?: string;
  /** In minutes: the movie, or an episode of the tv show. */
  runtime?: number;
  seasons?: number;
  episodes?: number;
  genres: Genre[];
  posterPath?: string;
  voteAverage?: number;
  voteCount?: number;
  /** Such as `tt0133093`, for a link to IMDb. */
  imdbId?: string;
  /** A video on YouTube. */
  trailer?: { key: string; name: string };
  /** The first names of the cast, in billing order. */
  cast: CastMember[];
  /** In the region of the request, when JustWatch knows of any. */
  watch?: WatchOptions;
}

export type TmdbErrorCode =
  | 'missing-credential'
  | 'unauthorized'
  | 'not-found'
  | 'rate-limited'
  | 'invalid-request'
  | 'server'
  | 'network'
  | 'timeout';

export interface TmdbFailure {
  code: TmdbErrorCode;
  /** HTTP status, when TMDB answered. */
  status?: number;
  message?: string;
}

// Errors lose their fields when they cross IPC, so calls that can fail
// answer with a result instead of rejecting.
export type Result<T> =
  { ok: true; data: T } | { ok: false; error: TmdbFailure };

export interface CredentialStatus {
  /** The user saved a TMDB key of their own, used instead of the app's. */
  hasKey: boolean;
  /** The key is saved for the next launch, not only kept in memory. */
  persisted: boolean;
  /** The saved key is encrypted by the operating system. */
  encrypted: boolean;
  /** The app was built with its own TMDB credential: no key is needed. */
  builtIn: boolean;
}

/** What the app shows of the TMDB account of whoever signed in. */
export interface Account {
  id: number;
  username: string;
  /** The name the user gave to TMDB, when there is one. */
  name?: string;
  /** Path of the picture the user uploaded to TMDB, when there is one. */
  avatarPath?: string;
}

export type LoginFailure =
  /** The access was refused on the TMDB website. */
  | 'denied'
  /** Nobody approved it in time. */
  | 'timeout'
  | 'network'
  /** TMDB would not start or finish the login: nothing the user can fix. */
  | 'unavailable';

// The session itself (TMDB's session_id) works as a password of the account
// and stays with whoever holds the credential of the app. The renderer only
// learns this much about it.
export type SessionState =
  | { status: 'anonymous' }
  | {
      /** Waiting for the user to approve on the TMDB website. */
      status: 'pending';
      /** When the app stops waiting, in milliseconds since the epoch. */
      expiresAt: number;
      /** The page to approve on, for a browser that did not open by itself. */
      authorizeUrl: string;
    }
  | {
      status: 'authenticated';
      account: Account;
      /** Desktop only: how the session is kept for the next launch. */
      kept?: SessionKeeping;
      /**
       * Desktop only: TMDB could not confirm, at this launch, the session
       * that the last one saved. Whoever it was stays signed in, with the
       * account saved then, and the app asks again by itself.
       */
      offline?: boolean;
    }
  | { status: 'error'; reason: LoginFailure };

/**
 * Where the desktop app keeps a session for the next launch. On the web the
 * site keeps it, in a cookie.
 */
export type SessionKeeping =
  /** Encrypted by the keyring of the system. */
  | 'encrypted'
  /** The system has no keyring, and the user agreed to keep it anyway. */
  | 'unencrypted'
  /**
   * The system has no keyring, so it is only kept until the app closes,
   * unless the user agrees to keep it unencrypted (`auth.remember()`).
   */
  | 'ask'
  /** It could not be written: it lasts until the app closes. */
  | 'failed';

export interface MediaAppApi {
  /**
   * Where the app is running: installed, inside Electron, or as a web page.
   * A web page has no key of the user to keep and no window chrome to theme.
   */
  platform: 'desktop' | 'web';
  /** Versions of the runtime the desktop app is running on. */
  versions?: {
    electron: string;
    node: string;
    chrome: string;
  };
  /** Makes the window chrome and `prefers-color-scheme` follow the app theme. */
  setNativeTheme(theme: NativeTheme): void;
  /** TMDB requests run in the main process, which holds the key. */
  tmdb: {
    search(request: SearchRequest): Promise<Result<Paged<MediaItem>>>;
    genres(language: string): Promise<Result<Genre[]>>;
    details(request: DetailsRequest): Promise<Result<MediaDetails>>;
  };
  /** The TMDB key never comes back to the renderer once it is saved. */
  credentials: {
    status(): Promise<CredentialStatus>;
    save(apiKey: string): Promise<CredentialStatus>;
    clear(): Promise<CredentialStatus>;
  };
  /**
   * Signing in to TMDB. It is optional: searching never needs it. The user
   * approves the access on the TMDB website, in their own browser, so the
   * app never sees a password.
   */
  auth: {
    getSession(): Promise<SessionState>;
    /**
     * Opens the approval page, with the result page in `language`. Answers
     * `pending` as soon as it is open: the rest arrives through `onChange`.
     * On the web the app itself goes to that page and is loaded again on the
     * way back, so there is no `pending` and nothing to wait for.
     */
    login(language: string): Promise<SessionState>;
    /**
     * For when the browser does not come back by itself: asks TMDB whether
     * the access was approved. Still `pending` when it was not.
     */
    confirmManual(): Promise<SessionState>;
    /** Gives up a login that is waiting, or dismisses one that failed. */
    cancelLogin(): Promise<SessionState>;
    logout(): Promise<SessionState>;
    /**
     * Keeps the session for the next launch on a system without a keyring,
     * where that means saving it unencrypted: only after the user agreed
     * (`kept` is `ask`). Elsewhere there is nothing to do.
     */
    remember(): Promise<SessionState>;
    /** Calls `listener` on every change. Returns how to stop listening. */
    onChange(listener: (state: SessionState) => void): () => void;
  };
}

/** IPC channel names, shared by the preload and the main process. */
export const IPC = {
  setNativeTheme: 'theme:set-native',
  tmdbSearch: 'tmdb:search',
  tmdbGenres: 'tmdb:genres',
  tmdbDetails: 'tmdb:details',
  credentialStatus: 'credentials:status',
  credentialSave: 'credentials:save',
  credentialClear: 'credentials:clear',
  authSession: 'auth:session',
  authLogin: 'auth:login',
  authConfirm: 'auth:confirm',
  authCancel: 'auth:cancel',
  authLogout: 'auth:logout',
  authRemember: 'auth:remember',
} as const;

/** Channels the main process sends on, without being asked. */
export const IPC_EVENTS = {
  authChanged: 'auth:changed',
} as const;
