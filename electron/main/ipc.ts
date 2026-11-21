import {
  IPC,
  type AccountListRequest,
  type CredentialStatus,
  type DetailsRequest,
  type DiscoverFilters,
  type DiscoverFiltersRequest,
  type DiscoverRequest,
  type Genre,
  type ListRequest,
  type MarkRequest,
  type MediaDetails,
  type MediaItem,
  type NativeTheme,
  type Paged,
  type PersonDetails,
  type PersonRequest,
  type ProgressRequest,
  type RateRequest,
  type RecommendationsRequest,
  type SeasonDetails,
  type SeasonRequest,
  type Result,
  type SearchItem,
  type SearchRequest,
  type SessionState,
  type ShowProgress,
  type TitleRequest,
  type TitleStates,
  type TmdbFailure,
  type UpdateState,
  type WatchedListRequest,
  type WatchedRequest,
} from '../../shared/api';
import { isNativeTheme } from './security';
import { TmdbError } from '../../shared/tmdb/client';
import {
  parseAccountListRequest,
  parseApiKey,
  parseDetailsRequest,
  parseDiscoverFiltersRequest,
  parseDiscoverRequest,
  parseLanguage,
  parseListRequest,
  parseMarkRequest,
  parsePersonRequest,
  parseProgressRequest,
  parseSeasonRequest,
  parseRateRequest,
  parseRecommendationsRequest,
  parseSearchRequest,
  parseTitleRequest,
  parseWatchedListRequest,
  parseWatchedRequest,
} from '../../shared/tmdb/validation';

/** The part of an IPC event that the handlers look at. */
export interface IpcEvent {
  senderFrame: { url: string } | null;
}

/** The part of Electron's ipcMain that the handlers are registered on. */
export interface IpcRegistry {
  on(
    channel: string,
    listener: (event: IpcEvent, ...args: unknown[]) => void,
  ): unknown;
  handle(
    channel: string,
    listener: (event: IpcEvent, ...args: unknown[]) => unknown,
  ): void;
}

export interface IpcServices {
  /** True when the message comes from the app's own page. */
  isTrustedSender(url: string): boolean;
  setNativeTheme(theme: NativeTheme): void;
  /** Forgets the genres kept on disk and the images Chromium kept. */
  clearCache(): Promise<null>;
  tmdb: {
    search(request: SearchRequest): Promise<Paged<SearchItem>>;
    details(request: DetailsRequest): Promise<MediaDetails>;
    person(request: PersonRequest): Promise<PersonDetails>;
    season(request: SeasonRequest): Promise<SeasonDetails>;
    discover(request: DiscoverRequest): Promise<Paged<MediaItem>>;
    discoverFilters(request: DiscoverFiltersRequest): Promise<DiscoverFilters>;
    list(request: ListRequest): Promise<MediaItem[]>;
    regions(): Promise<string[]>;
  };
  genres: { get(language: string): Promise<Genre[]> };
  /** With the session of whoever signed in; `signed-out` otherwise. */
  account: {
    states(request: TitleRequest): Promise<TitleStates>;
    mark(request: MarkRequest): Promise<null>;
    rate(request: RateRequest): Promise<null>;
    list(request: AccountListRequest): Promise<Paged<MediaItem>>;
    /** Also needs the access token of the user: `sign-in-again`. */
    recommendations(request: RecommendationsRequest): Promise<MediaItem[]>;
  };
  /** With the access token of the user; `sign-in-again` without it. */
  watched: {
    state(request: TitleRequest): Promise<boolean>;
    mark(request: WatchedRequest): Promise<null>;
    list(request: WatchedListRequest): Promise<Paged<MediaItem>>;
    progress(): Promise<ShowProgress[]>;
    saveProgress(request: ProgressRequest): Promise<null>;
  };
  credentials: {
    status(): CredentialStatus;
    save(apiKey: string): Promise<CredentialStatus>;
    clear(): Promise<CredentialStatus>;
  };
  auth: {
    getSession(): SessionState;
    login(language: string): Promise<SessionState>;
    confirmManual(): Promise<SessionState>;
    cancelLogin(): SessionState;
    logout(): Promise<SessionState>;
    remember(): Promise<SessionState>;
  };
  updates: {
    getState(): UpdateState;
    install(): Promise<void>;
  };
}

const NO_CREDENTIAL: CredentialStatus = {
  hasKey: false,
  persisted: false,
  encrypted: false,
  builtIn: false,
};

const NO_SESSION: SessionState = { status: 'anonymous' };

const NO_UPDATE: UpdateState = { status: 'idle' };

function toFailure(error: unknown): TmdbFailure {
  if (error instanceof TmdbError) {
    return { code: error.code, status: error.status, message: error.message };
  }

  return {
    code: 'server',
    message: error instanceof Error ? error.message : String(error),
  };
}

async function toResult<T>(task: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await task() };
  } catch (error) {
    return { ok: false, error: toFailure(error) };
  }
}

/**
 * Connects the channels of shared/api.ts to the services. Every handler
 * checks who is asking and validates what was sent before acting on it.
 */
export function registerIpc(ipc: IpcRegistry, services: IpcServices) {
  const isTrusted = (event: IpcEvent) =>
    event.senderFrame !== null &&
    services.isTrustedSender(event.senderFrame.url);
  const invalidRequest = (): Result<never> => ({
    ok: false,
    error: { code: 'invalid-request' },
  });

  ipc.on(IPC.setNativeTheme, (event, theme) => {
    if (isTrusted(event) && isNativeTheme(theme)) {
      services.setNativeTheme(theme);
    }
  });

  ipc.handle(IPC.tmdbSearch, (event, value) => {
    const request = isTrusted(event) ? parseSearchRequest(value) : null;

    return request
      ? toResult(() => services.tmdb.search(request))
      : invalidRequest();
  });

  ipc.handle(IPC.tmdbGenres, (event, value) => {
    const language = isTrusted(event) ? parseLanguage(value) : null;

    return language
      ? toResult(() => services.genres.get(language))
      : invalidRequest();
  });

  ipc.handle(IPC.tmdbDetails, (event, value) => {
    const request = isTrusted(event) ? parseDetailsRequest(value) : null;

    return request
      ? toResult(() => services.tmdb.details(request))
      : invalidRequest();
  });

  ipc.handle(IPC.tmdbPerson, (event, value) => {
    const request = isTrusted(event) ? parsePersonRequest(value) : null;

    return request
      ? toResult(() => services.tmdb.person(request))
      : invalidRequest();
  });

  ipc.handle(IPC.tmdbSeason, (event, value) => {
    const request = isTrusted(event) ? parseSeasonRequest(value) : null;

    return request
      ? toResult(() => services.tmdb.season(request))
      : invalidRequest();
  });

  ipc.handle(IPC.tmdbDiscover, (event, value) => {
    const request = isTrusted(event) ? parseDiscoverRequest(value) : null;

    return request
      ? toResult(() => services.tmdb.discover(request))
      : invalidRequest();
  });

  ipc.handle(IPC.tmdbDiscoverFilters, (event, value) => {
    const request = isTrusted(event)
      ? parseDiscoverFiltersRequest(value)
      : null;

    return request
      ? toResult(() => services.tmdb.discoverFilters(request))
      : invalidRequest();
  });

  ipc.handle(IPC.tmdbList, (event, value) => {
    const request = isTrusted(event) ? parseListRequest(value) : null;

    return request
      ? toResult(() => services.tmdb.list(request))
      : invalidRequest();
  });

  ipc.handle(IPC.tmdbRegions, (event) =>
    isTrusted(event)
      ? toResult(() => services.tmdb.regions())
      : invalidRequest(),
  );

  ipc.handle(IPC.clearCache, (event) =>
    isTrusted(event) ? toResult(() => services.clearCache()) : invalidRequest(),
  );

  ipc.handle(IPC.accountStates, (event, value) => {
    const request = isTrusted(event) ? parseTitleRequest(value) : null;

    return request
      ? toResult(() => services.account.states(request))
      : invalidRequest();
  });

  ipc.handle(IPC.accountMark, (event, value) => {
    const request = isTrusted(event) ? parseMarkRequest(value) : null;

    return request
      ? toResult(() => services.account.mark(request))
      : invalidRequest();
  });

  ipc.handle(IPC.accountRate, (event, value) => {
    const request = isTrusted(event) ? parseRateRequest(value) : null;

    return request
      ? toResult(() => services.account.rate(request))
      : invalidRequest();
  });

  ipc.handle(IPC.accountList, (event, value) => {
    const request = isTrusted(event) ? parseAccountListRequest(value) : null;

    return request
      ? toResult(() => services.account.list(request))
      : invalidRequest();
  });

  ipc.handle(IPC.accountRecommendations, (event, value) => {
    const request = isTrusted(event)
      ? parseRecommendationsRequest(value)
      : null;

    return request
      ? toResult(() => services.account.recommendations(request))
      : invalidRequest();
  });

  ipc.handle(IPC.watchedState, (event, value) => {
    const request = isTrusted(event) ? parseTitleRequest(value) : null;

    return request
      ? toResult(() => services.watched.state(request))
      : invalidRequest();
  });

  ipc.handle(IPC.watchedMark, (event, value) => {
    const request = isTrusted(event) ? parseWatchedRequest(value) : null;

    return request
      ? toResult(() => services.watched.mark(request))
      : invalidRequest();
  });

  ipc.handle(IPC.watchedList, (event, value) => {
    const request = isTrusted(event) ? parseWatchedListRequest(value) : null;

    return request
      ? toResult(() => services.watched.list(request))
      : invalidRequest();
  });

  ipc.handle(IPC.watchedProgress, (event) =>
    isTrusted(event)
      ? toResult(() => services.watched.progress())
      : invalidRequest(),
  );

  ipc.handle(IPC.watchedSaveProgress, (event, value) => {
    const request = isTrusted(event) ? parseProgressRequest(value) : null;

    return request
      ? toResult(() => services.watched.saveProgress(request))
      : invalidRequest();
  });

  ipc.handle(IPC.credentialStatus, (event) =>
    isTrusted(event) ? services.credentials.status() : NO_CREDENTIAL,
  );

  ipc.handle(IPC.credentialSave, (event, value) => {
    if (!isTrusted(event)) {
      return NO_CREDENTIAL;
    }

    const apiKey = parseApiKey(value);

    // A key that does not look like one is not saved: the status stays as is.
    return apiKey
      ? services.credentials.save(apiKey)
      : services.credentials.status();
  });

  ipc.handle(IPC.credentialClear, (event) =>
    isTrusted(event) ? services.credentials.clear() : NO_CREDENTIAL,
  );

  ipc.handle(IPC.authSession, (event) =>
    isTrusted(event) ? services.auth.getSession() : NO_SESSION,
  );

  // The language only picks the text of the page that the browser shows at
  // the end, so an unknown one is no reason to refuse the login.
  ipc.handle(IPC.authLogin, (event, value) =>
    isTrusted(event)
      ? services.auth.login(parseLanguage(value) ?? 'en')
      : NO_SESSION,
  );

  ipc.handle(IPC.authConfirm, (event) =>
    isTrusted(event) ? services.auth.confirmManual() : NO_SESSION,
  );

  ipc.handle(IPC.authCancel, (event) =>
    isTrusted(event) ? services.auth.cancelLogin() : NO_SESSION,
  );

  ipc.handle(IPC.authLogout, (event) =>
    isTrusted(event) ? services.auth.logout() : NO_SESSION,
  );

  ipc.handle(IPC.authRemember, (event) =>
    isTrusted(event) ? services.auth.remember() : NO_SESSION,
  );

  ipc.handle(IPC.updatesState, (event) =>
    isTrusted(event) ? services.updates.getState() : NO_UPDATE,
  );

  ipc.handle(IPC.updatesInstall, async (event) => {
    if (isTrusted(event)) {
      await services.updates.install();
    }
  });
}
