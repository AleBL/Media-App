// The API that the preload script exposes to the renderer as `window.api`.
// The renderer has no Node or Electron access: whatever it needs from the
// main process goes through here.

export type NativeTheme = 'system' | 'light' | 'dark';

export type MediaType = 'movie' | 'tv';

/** TMDB always answers searches with 20 results per page. */
export const TMDB_PAGE_SIZE = 20;

// A movie or tv show as returned by the TMDB search endpoints. Movies
// carry title/release_date, tv shows carry name/first_air_date.
export interface MediaItem {
  id: number;
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

export interface MediaAppApi {
  /** Versions of the runtime the app is running on. */
  versions: {
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
  };
  /** The TMDB key never comes back to the renderer once it is saved. */
  credentials: {
    status(): Promise<CredentialStatus>;
    save(apiKey: string): Promise<CredentialStatus>;
    clear(): Promise<CredentialStatus>;
  };
}

/** IPC channel names, shared by the preload and the main process. */
export const IPC = {
  setNativeTheme: 'theme:set-native',
  tmdbSearch: 'tmdb:search',
  tmdbGenres: 'tmdb:genres',
  credentialStatus: 'credentials:status',
  credentialSave: 'credentials:save',
  credentialClear: 'credentials:clear',
} as const;
