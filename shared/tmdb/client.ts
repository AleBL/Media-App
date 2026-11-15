import {
  TMDB_PAGE_SIZE,
  type Account,
  type Genre,
  type MediaItem,
  type Paged,
  type SearchRequest,
  type TmdbErrorCode,
} from '../api';

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/** TMDB rejects pages above this one. */
export const TMDB_MAX_PAGES = 500;

export class TmdbError extends Error {
  constructor(
    readonly code: TmdbErrorCode,
    readonly status?: number,
    message?: string,
    /** TMDB's own `status_code`, which tells apart failures of one status. */
    readonly tmdbStatus?: number,
  ) {
    super(message ?? code);
    this.name = 'TmdbError';
  }
}

type FetchResponse = Pick<Response, 'ok' | 'status' | 'headers' | 'json'>;

export type FetchLike = (
  url: string,
  init: {
    /** GET when missing. */
    method?: string;
    headers: Record<string, string>;
    /** JSON, sent with the requests that change something at TMDB. */
    body?: string;
    signal: AbortSignal;
  },
) => Promise<FetchResponse>;

export interface TmdbClientOptions {
  /** The credential to send to TMDB, or null when there is none. */
  getCredential: () => string | null;
  fetch: FetchLike;
  baseUrl?: string;
  timeoutMs?: number;
  /** Extra attempts after TMDB answers 429 (too many requests). */
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
}

type SearchBody = {
  page?: number;
  results?: MediaItem[];
  total_pages?: number;
  total_results?: number;
};

type GenreBody = { genres?: Partial<Genre>[] };

type AccountBody = {
  id?: unknown;
  username?: unknown;
  name?: unknown;
  avatar?: { tmdb?: { avatar_path?: unknown } };
};

/** What a request that changes something at TMDB sends. */
type Send = { method: 'POST' | 'DELETE'; body: Record<string, string> };

// A v4 "API Read Access Token" is a JWT and goes in the Authorization
// header; a v3 "API Key" goes in the query string.
function isAccessToken(credential: string) {
  return credential.split('.').length === 3;
}

function codeForStatus(status: number): TmdbErrorCode {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'not-found';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server';
  return 'invalid-request';
}

function isTimeout(error: unknown) {
  return error instanceof Error && error.name === 'TimeoutError';
}

/** How long to wait before retrying, from the Retry-After header. */
function retryDelayMs(header: string | null) {
  const seconds = Number(header);

  return (
    Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds : 1, 5) * 1000
  );
}

/** What TMDB says about a request it refused. */
async function refusal(response: FetchResponse) {
  try {
    const body = (await response.json()) as {
      status_code?: unknown;
      status_message?: unknown;
    };

    return {
      message:
        typeof body.status_message === 'string'
          ? body.status_message
          : undefined,
      tmdbStatus:
        typeof body.status_code === 'number' ? body.status_code : undefined,
    };
  } catch {
    return {};
  }
}

function unreadable(): never {
  throw new TmdbError('server', 200, 'Unreadable answer');
}

// Only the fields the app uses cross to the renderer.
function toAccount(body: AccountBody): Account {
  if (typeof body.id !== 'number' || typeof body.username !== 'string') {
    return unreadable();
  }

  const account: Account = { id: body.id, username: body.username };
  const avatarPath = body.avatar?.tmdb?.avatar_path;

  if (typeof body.name === 'string' && body.name) {
    account.name = body.name;
  }

  if (typeof avatarPath === 'string' && avatarPath) {
    account.avatarPath = avatarPath;
  }

  return account;
}

// Only the fields the app uses cross to the renderer.
function toMediaItem(item: MediaItem): MediaItem {
  return {
    id: item.id,
    title: item.title,
    name: item.name,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    poster_path: item.poster_path,
    genre_ids: item.genre_ids,
    vote_average: item.vote_average,
  };
}

export function createTmdbClient(options: TmdbClientOptions) {
  const baseUrl = (options.baseUrl || TMDB_BASE_URL).replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? 8000;
  const retries = options.retries ?? 2;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function request<T>(
    path: string,
    params: Record<string, string | number>,
    send?: Send,
  ): Promise<T> {
    const credential = options.getCredential();

    if (!credential) {
      throw new TmdbError('missing-credential');
    }

    const url = new URL(`${baseUrl}${path}`);
    const headers: Record<string, string> = { Accept: 'application/json' };
    const content = send
      ? { method: send.method, body: JSON.stringify(send.body) }
      : {};

    if (send) {
      headers['Content-Type'] = 'application/json';
    }

    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, String(value));
    }

    if (isAccessToken(credential)) {
      headers.Authorization = `Bearer ${credential}`;
    } else {
      url.searchParams.set('api_key', credential);
    }

    for (let attempt = 0; ; attempt += 1) {
      let response: FetchResponse;

      try {
        response = await options.fetch(url.toString(), {
          ...content,
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        // The url may hold the key or a session, so it never goes into an
        // error message.
        throw new TmdbError(isTimeout(error) ? 'timeout' : 'network');
      }

      if (response.status === 429 && attempt < retries) {
        await sleep(retryDelayMs(response.headers.get('Retry-After')));
        continue;
      }

      if (!response.ok) {
        const { message, tmdbStatus } = await refusal(response);

        throw new TmdbError(
          codeForStatus(response.status),
          response.status,
          message,
          tmdbStatus,
        );
      }

      try {
        return (await response.json()) as T;
      } catch {
        throw new TmdbError('server', response.status, 'Unreadable answer');
      }
    }
  }

  return {
    async search(search: SearchRequest): Promise<Paged<MediaItem>> {
      const body = await request<SearchBody>(`/search/${search.type}`, {
        query: search.query,
        page: search.page,
        language: search.language,
        include_adult: 'false',
      });

      return {
        page: body.page ?? search.page,
        results: (body.results ?? []).map(toMediaItem),
        totalPages: Math.min(body.total_pages ?? 0, TMDB_MAX_PAGES),
        totalResults: Math.min(
          body.total_results ?? 0,
          TMDB_MAX_PAGES * TMDB_PAGE_SIZE,
        ),
      };
    },

    /** Movie and tv genres in one list, without repeated ids. */
    async genres(language: string): Promise<Genre[]> {
      const [movie, tv] = await Promise.all([
        request<GenreBody>('/genre/movie/list', { language }),
        request<GenreBody>('/genre/tv/list', { language }),
      ]);
      const byId = new Map<number, Genre>();

      for (const genre of [...(movie.genres ?? []), ...(tv.genres ?? [])]) {
        if (
          typeof genre.id === 'number' &&
          typeof genre.name === 'string' &&
          genre.name &&
          !byId.has(genre.id)
        ) {
          byId.set(genre.id, { id: genre.id, name: genre.name });
        }
      }

      return [...byId.values()];
    },

    /**
     * First step of signing in: a token for the user to approve on the TMDB
     * website. TMDB forgets it after 60 minutes.
     */
    async createRequestToken(): Promise<string> {
      const body = await request<{ request_token?: unknown }>(
        '/authentication/token/new',
        {},
      );

      return typeof body.request_token === 'string' && body.request_token
        ? body.request_token
        : unreadable();
    },

    /**
     * Trades an approved request token for a session, once. TMDB answers 401
     * with `status_code` 17 for a token that was not approved or was already
     * traded.
     */
    async createSession(requestToken: string): Promise<string> {
      const body = await request<{ session_id?: unknown }>(
        '/authentication/session/new',
        {},
        { method: 'POST', body: { request_token: requestToken } },
      );

      return typeof body.session_id === 'string' && body.session_id
        ? body.session_id
        : unreadable();
    },

    /** The account a session belongs to. 401 when the session is over. */
    async account(sessionId: string): Promise<Account> {
      return toAccount(
        await request<AccountBody>('/account', { session_id: sessionId }),
      );
    },

    /** Ends a session at TMDB: it stops working everywhere. */
    async deleteSession(sessionId: string): Promise<void> {
      await request(
        '/authentication/session',
        {},
        { method: 'DELETE', body: { session_id: sessionId } },
      );
    },
  };
}

export type TmdbClient = ReturnType<typeof createTmdbClient>;
