import {
  TMDB_PAGE_SIZE,
  type Account,
  type CastMember,
  type DetailsRequest,
  type Genre,
  type ListRequest,
  type MediaDetails,
  type MediaItem,
  type MediaList,
  type MediaType,
  type Paged,
  type SearchRequest,
  type TmdbErrorCode,
  type WatchOptions,
  type WatchProvider,
} from '../api';

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/** TMDB rejects pages above this one. */
export const TMDB_MAX_PAGES = 500;

/** How many of the cast the page of a title shows. */
export const CAST_SIZE = 12;

const YOUTUBE_KEY = /^[\w-]{6,32}$/;
const IMDB_ID = /^tt\d{5,10}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TMDB_WEBSITE = 'https://www.themoviedb.org/';

/** Where TMDB has each list, and the type of what it lists. */
const LISTS: Record<MediaList, { path: string; type?: MediaType }> = {
  // Each title of it says what it is; people are in it too.
  trending: { path: '/trending/all/week' },
  'popular-movies': { path: '/movie/popular', type: 'movie' },
  'popular-tv': { path: '/tv/popular', type: 'tv' },
};

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

// The page of a movie or tv show, with what append_to_response added. Read
// field by field: nothing in it is taken on trust.
type DetailsBody = {
  id?: unknown;
  adult?: unknown;
  title?: unknown;
  name?: unknown;
  original_title?: unknown;
  original_name?: unknown;
  tagline?: unknown;
  overview?: unknown;
  release_date?: unknown;
  first_air_date?: unknown;
  runtime?: unknown;
  episode_run_time?: unknown;
  last_episode_to_air?: { runtime?: unknown } | null;
  number_of_seasons?: unknown;
  number_of_episodes?: unknown;
  genres?: unknown;
  poster_path?: unknown;
  vote_average?: unknown;
  vote_count?: unknown;
  imdb_id?: unknown;
  external_ids?: { imdb_id?: unknown } | null;
  videos?: { results?: unknown } | null;
  credits?: { cast?: unknown } | null;
  'watch/providers'?: { results?: unknown } | null;
};

type Fields = Record<string, unknown>;

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
function toMediaItem(item: MediaItem, type: MediaType): MediaItem {
  return {
    id: item.id,
    media_type: type,
    title: item.title,
    name: item.name,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    poster_path: item.poster_path,
    genre_ids: item.genre_ids,
    vote_average: item.vote_average,
  };
}

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : undefined;

const positive = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;

const objects = (value: unknown): Fields[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Fields => typeof entry === 'object' && entry !== null,
      )
    : [];

/**
 * The trailer to offer: a YouTube video, in the language of the app before
 * English and before any other, a trailer before a teaser, an official one
 * before the rest.
 */
function pickTrailer(videos: unknown, language: string) {
  const own = language.slice(0, 2);
  const score = (video: Fields) => [
    video.iso_639_1 === own ? 0 : video.iso_639_1 === 'en' ? 1 : 2,
    video.type === 'Trailer' ? 0 : 1,
    video.official === true ? 0 : 1,
  ];
  const [best] = objects(videos)
    .filter(
      (video) =>
        video.site === 'YouTube' &&
        (video.type === 'Trailer' || video.type === 'Teaser') &&
        typeof video.key === 'string' &&
        YOUTUBE_KEY.test(video.key),
    )
    .sort((a, b) => {
      const [first, second] = [score(a), score(b)];
      const index = first.findIndex((value, i) => value !== second[i]);

      return index === -1 ? 0 : first[index] - second[index];
    });

  return best
    ? { key: best.key as string, name: text(best.name) ?? '' }
    : undefined;
}

function toCast(cast: unknown): CastMember[] {
  return objects(cast)
    .filter((person) => typeof person.id === 'number' && text(person.name))
    .slice(0, CAST_SIZE)
    .map((person) => ({
      id: person.id as number,
      name: person.name as string,
      character: text(person.character),
      profilePath: text(person.profile_path),
    }));
}

/** The services of one or more lists, in the order JustWatch ranks them. */
function toProviders(...lists: unknown[]): WatchProvider[] {
  const seen = new Set<number>();
  const rank = (provider: Fields) =>
    typeof provider.display_priority === 'number'
      ? provider.display_priority
      : Number.MAX_SAFE_INTEGER;

  return lists
    .flatMap(objects)
    .filter(
      (provider) =>
        typeof provider.provider_id === 'number' &&
        text(provider.provider_name),
    )
    .sort((a, b) => rank(a) - rank(b))
    .filter((provider) => {
      const id = provider.provider_id as number;

      return seen.has(id) ? false : (seen.add(id), true);
    })
    .map((provider) => ({
      id: provider.provider_id as number,
      name: provider.provider_name as string,
      logoPath: text(provider.logo_path),
    }));
}

/** Where to watch in `region`: TMDB sends every country at once. */
function toWatch(results: unknown, region: string): WatchOptions | undefined {
  const entry =
    typeof results === 'object' &&
    results !== null &&
    Object.hasOwn(results, region)
      ? (results as Record<string, unknown>)[region]
      : undefined;

  if (typeof entry !== 'object' || entry === null) {
    return undefined;
  }

  const { link, flatrate, free, ads, rent, buy } = entry as Fields;
  const options: WatchOptions = {
    link:
      typeof link === 'string' && link.startsWith(TMDB_WEBSITE)
        ? link
        : undefined,
    stream: toProviders(flatrate),
    free: toProviders(free, ads),
    rent: toProviders(rent),
    buy: toProviders(buy),
  };
  const any =
    options.stream.length +
    options.free.length +
    options.rent.length +
    options.buy.length;

  return any > 0 ? options : undefined;
}

function toDetails(body: DetailsBody, request: DetailsRequest): MediaDetails {
  const { type, language, region } = request;
  const movie = type === 'movie';
  const title = text(movie ? body.title : body.name);

  if (typeof body.id !== 'number' || !title) {
    return unreadable();
  }

  // Searches leave adult titles out, so their pages are not shown either.
  if (body.adult === true) {
    throw new TmdbError('not-found', 404);
  }

  const original = text(movie ? body.original_title : body.original_name);
  const date = text(movie ? body.release_date : body.first_air_date);
  const episodeRuntime = Array.isArray(body.episode_run_time)
    ? body.episode_run_time[0]
    : undefined;
  const voteCount = positive(body.vote_count);

  return {
    type,
    id: body.id,
    title,
    originalTitle: original !== title ? original : undefined,
    tagline: text(body.tagline),
    overview: text(body.overview),
    date: date && DATE.test(date) ? date : undefined,
    runtime: movie
      ? positive(body.runtime)
      : (positive(episodeRuntime) ??
        positive(body.last_episode_to_air?.runtime)),
    seasons: movie ? undefined : positive(body.number_of_seasons),
    episodes: movie ? undefined : positive(body.number_of_episodes),
    genres: objects(body.genres).flatMap((genre) =>
      typeof genre.id === 'number' && text(genre.name)
        ? [{ id: genre.id, name: genre.name as string }]
        : [],
    ),
    posterPath: text(body.poster_path),
    voteAverage: voteCount ? positive(body.vote_average) : undefined,
    voteCount,
    // Only movies have it in the page itself.
    imdbId: [body.imdb_id, body.external_ids?.imdb_id].find(
      (id): id is string => typeof id === 'string' && IMDB_ID.test(id),
    ),
    trailer: pickTrailer(body.videos?.results, language),
    cast: toCast(body.credits?.cast),
    watch: toWatch(body['watch/providers']?.results, region),
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
        results: (body.results ?? []).map((item) =>
          toMediaItem(item, search.type),
        ),
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
     * The first page of a list of the home page: movies and tv shows only,
     * without adult titles, each tagged with its type.
     */
    async list({ list, language }: ListRequest): Promise<MediaItem[]> {
      const { path, type } = LISTS[list];
      const body = await request<{ results?: (MediaItem & Fields)[] }>(path, {
        language,
      });

      return (body.results ?? []).flatMap((item) => {
        const itemType = type ?? item.media_type;

        return (itemType === 'movie' || itemType === 'tv') &&
          typeof item.id === 'number' &&
          item.adult !== true
          ? [toMediaItem(item, itemType)]
          : [];
      });
    },

    /**
     * The page of a movie or tv show, with its cast, trailer, IMDb id and
     * where to watch it in the region asked for, in one request.
     */
    async details(details: DetailsRequest): Promise<MediaDetails> {
      const own = details.language.slice(0, 2);
      // TMDB only sends the videos in the language asked for, unless told
      // which others to add. A language with a country (pt-BR) does not
      // match one without it (pt), so both go in, then English and the
      // videos that have no language.
      const videoLanguages = new Set([
        details.language,
        own,
        `${own}-${details.region}`,
        'en',
        'null',
      ]);
      const body = await request<DetailsBody>(
        `/${details.type}/${details.id}`,
        {
          language: details.language,
          append_to_response: 'credits,videos,watch/providers,external_ids',
          include_video_language: [...videoLanguages].join(','),
        },
      );

      return toDetails(body, details);
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
