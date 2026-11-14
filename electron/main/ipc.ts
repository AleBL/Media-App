import {
  IPC,
  type CredentialStatus,
  type Genre,
  type MediaItem,
  type NativeTheme,
  type Paged,
  type Result,
  type SearchRequest,
  type TmdbFailure,
} from '../../shared/api';
import { isNativeTheme } from './security';
import { TmdbError } from './tmdb/client';
import {
  parseApiKey,
  parseLanguage,
  parseSearchRequest,
} from './tmdb/validation';

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
  tmdb: { search(request: SearchRequest): Promise<Paged<MediaItem>> };
  genres: { get(language: string): Promise<Genre[]> };
  credentials: {
    status(): CredentialStatus;
    save(apiKey: string): Promise<CredentialStatus>;
    clear(): Promise<CredentialStatus>;
  };
}

const NO_CREDENTIAL: CredentialStatus = {
  hasKey: false,
  persisted: false,
  encrypted: false,
  builtIn: false,
};

function toFailure(error: unknown): TmdbFailure {
  if (error instanceof TmdbError) {
    return { code: error.code, status: error.status, message: error.message };
  }

  return {
    code: 'server',
    message: error instanceof Error ? error.message : String(error),
  };
}

async function attempt<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, error: toFailure(error) };
  }
}

/**
 * Connects the channels of shared/api.ts to the services. Every handler
 * checks who is asking and validates what was sent before acting on it.
 */
export function registerIpc(ipc: IpcRegistry, services: IpcServices) {
  const trusted = (event: IpcEvent) =>
    event.senderFrame !== null &&
    services.isTrustedSender(event.senderFrame.url);
  const invalid = (): Result<never> => ({
    ok: false,
    error: { code: 'invalid-request' },
  });

  ipc.on(IPC.setNativeTheme, (event, theme) => {
    if (trusted(event) && isNativeTheme(theme)) {
      services.setNativeTheme(theme);
    }
  });

  ipc.handle(IPC.tmdbSearch, (event, value) => {
    const request = trusted(event) ? parseSearchRequest(value) : null;

    return request ? attempt(() => services.tmdb.search(request)) : invalid();
  });

  ipc.handle(IPC.tmdbGenres, (event, value) => {
    const language = trusted(event) ? parseLanguage(value) : null;

    return language ? attempt(() => services.genres.get(language)) : invalid();
  });

  ipc.handle(IPC.credentialStatus, (event) =>
    trusted(event) ? services.credentials.status() : NO_CREDENTIAL,
  );

  ipc.handle(IPC.credentialSave, (event, value) => {
    if (!trusted(event)) {
      return NO_CREDENTIAL;
    }

    const apiKey = parseApiKey(value);

    // A key that does not look like one is not saved: the status stays as is.
    return apiKey
      ? services.credentials.save(apiKey)
      : services.credentials.status();
  });

  ipc.handle(IPC.credentialClear, (event) =>
    trusted(event) ? services.credentials.clear() : NO_CREDENTIAL,
  );
}
