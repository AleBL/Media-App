import {
  RATINGS,
  TMDB_PAGE_SIZE,
  type Account,
  type AccountListRequest,
  type CastMember,
  type DetailsRequest,
  type Genre,
  type ListRequest,
  type MediaDetails,
  type MediaItem,
  type MediaList,
  type MarkRequest,
  type MediaType,
  type Paged,
  type PersonItem,
  type RateRequest,
  type SearchItem,
  type SearchRequest,
  type TitleRequest,
  type TitleStates,
  type TmdbErrorCode,
  type WatchOptions,
  type WatchProvider,
} from '../api';

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/** TMDB rejects pages above this one. */
export const TMDB_MAX_PAGES = 500;

export const CAST_SIZE = 12;

export const KNOWN_FOR_SIZE = 3;

const YOUTUBE_KEY = /^[\w-]{6,32}$/;
const IMDB_ID = /^tt\d{5,10}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TMDB_WEBSITE = 'https://www.themoviedb.org/';

const LISTS: Record<MediaList, { path: string; type?: MediaType }> = {
  // Each item says its own type.
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
    method?: string;
    headers: Record<string, string>;
    body?: string;
    signal: AbortSignal;
  },
) => Promise<FetchResponse>;

export interface TmdbClientOptions {
  getCredential: () => string | null;
  fetch: FetchLike;
  baseUrl?: string;
  timeoutMs?: number;
  /** Extra attempts after a 429 (too many requests). */
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
}

interface RequestOptions {
  params?: Record<string, string | number>;
  method?: 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  v4?: boolean;
  /** The user's v4 access token, used instead of the app credential. */
  userToken?: string;
}

type SearchBody = {
  page?: number;
  results?: JsonObject[];
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
  backdrop_path?: unknown;
  vote_average?: unknown;
  vote_count?: unknown;
  imdb_id?: unknown;
  external_ids?: { imdb_id?: unknown } | null;
  videos?: { results?: unknown } | null;
  credits?: { cast?: unknown } | null;
  'watch/providers'?: { results?: unknown } | null;
};

type JsonObject = Record<string, unknown>;

/**
 * What signing in gives. The v4 login (with the app's read access token)
 * also gives the user's access token, which their lists need.
 */
export interface Access {
  /** v3 session_id: watchlist, favorites and ratings. */
  sessionId: string;
  accessToken?: string;
  /** The v4 account id, such as "5f0c...", not the v3 number. */
  accountObjectId?: string;
}

/** A list the user made at TMDB (v4). */
export interface UserList {
  id: number;
  name: string;
  description: string;
}

/**
 * v4 tokens (the app's read access token, request tokens) are JWTs; v3 keys
 * and request tokens are plain hex.
 */
export const isJwt = (token: string) => token.split('.').length === 3;

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

/** From the Retry-After header, between 1 and 5 seconds. */
function retryDelayMs(header: string | null) {
  const seconds = Number(header);

  return (
    Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds : 1, 5) * 1000
  );
}

async function readError(response: FetchResponse) {
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

function invalidResponse(): never {
  throw new TmdbError('server', 200, 'Unreadable answer');
}

function toAccount(body: AccountBody): Account {
  if (typeof body.id !== 'number' || typeof body.username !== 'string') {
    return invalidResponse();
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

// Only the fields the app uses reach the renderer.
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
    overview: nonEmptyText(item.overview),
  };
}

const nonEmptyText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : undefined;

const positiveNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;

const toRating = (value: unknown) =>
  typeof value === 'number' && RATINGS.includes(value) ? value : undefined;

const objectArray = (value: unknown): JsonObject[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is JsonObject =>
          typeof entry === 'object' && entry !== null,
      )
    : [];

/** The item as a movie or tv show, or nothing (for flatMap). */
function toTitles(item: JsonObject, type: unknown): MediaItem[] {
  return (type === 'movie' || type === 'tv') &&
    typeof item.id === 'number' &&
    item.adult !== true
    ? [toMediaItem(item as MediaItem & JsonObject, type)]
    : [];
}

function toPaged<T>(
  body: SearchBody,
  page: number,
  read: (item: JsonObject) => T[],
): Paged<T> {
  return {
    page: body.page ?? page,
    results: (body.results ?? []).flatMap(read),
    totalPages: Math.min(body.total_pages ?? 0, TMDB_MAX_PAGES),
    totalResults: Math.min(
      body.total_results ?? 0,
      TMDB_MAX_PAGES * TMDB_PAGE_SIZE,
    ),
  };
}

/** The item as a person, or nothing (for flatMap). */
function toPeople(item: JsonObject): PersonItem[] {
  const name = nonEmptyText(item.name);

  if (typeof item.id !== 'number' || !name || item.adult === true) {
    return [];
  }

  return [
    {
      id: item.id,
      media_type: 'person',
      name,
      profile_path: nonEmptyText(item.profile_path),
      // Only names that lead to the titles: no synopsis.
      known_for: objectArray(item.known_for)
        .flatMap((title) => toTitles(title, title.media_type))
        .map((title) => {
          delete title.overview;
          return title;
        })
        .slice(0, KNOWN_FOR_SIZE),
    },
  ];
}

/**
 * A YouTube trailer: the app language first, then English, a trailer before
 * a teaser, an official one before the rest.
 */
function pickTrailer(videos: unknown, language: string) {
  const baseLanguage = language.slice(0, 2);
  const score = (video: JsonObject) => [
    video.iso_639_1 === baseLanguage ? 0 : video.iso_639_1 === 'en' ? 1 : 2,
    video.type === 'Trailer' ? 0 : 1,
    video.official === true ? 0 : 1,
  ];
  const [best] = objectArray(videos)
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
    ? { key: best.key as string, name: nonEmptyText(best.name) ?? '' }
    : undefined;
}

function toCast(cast: unknown): CastMember[] {
  return objectArray(cast)
    .filter(
      (person) => typeof person.id === 'number' && nonEmptyText(person.name),
    )
    .slice(0, CAST_SIZE)
    .map((person) => ({
      id: person.id as number,
      name: person.name as string,
      character: nonEmptyText(person.character),
      profilePath: nonEmptyText(person.profile_path),
    }));
}

/** The providers of the given lists, without repeats, in JustWatch order. */
function toProviders(...lists: unknown[]): WatchProvider[] {
  const seen = new Set<number>();
  const rank = (provider: JsonObject) =>
    typeof provider.display_priority === 'number'
      ? provider.display_priority
      : Number.MAX_SAFE_INTEGER;

  return lists
    .flatMap(objectArray)
    .filter(
      (provider) =>
        typeof provider.provider_id === 'number' &&
        nonEmptyText(provider.provider_name),
    )
    .sort((a, b) => rank(a) - rank(b))
    .filter((provider) => {
      const id = provider.provider_id as number;

      return seen.has(id) ? false : (seen.add(id), true);
    })
    .map((provider) => ({
      id: provider.provider_id as number,
      name: provider.provider_name as string,
      logoPath: nonEmptyText(provider.logo_path),
    }));
}

/** TMDB sends every country at once: this picks `region`. */
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

  const { link, flatrate, free, ads, rent, buy } = entry as JsonObject;
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
  const providerCount =
    options.stream.length +
    options.free.length +
    options.rent.length +
    options.buy.length;

  return providerCount > 0 ? options : undefined;
}

function toDetails(body: DetailsBody, request: DetailsRequest): MediaDetails {
  const { type, language, region } = request;
  const movie = type === 'movie';
  const title = nonEmptyText(movie ? body.title : body.name);

  if (typeof body.id !== 'number' || !title) {
    return invalidResponse();
  }

  // Searches leave adult titles out, so their pages are hidden too.
  if (body.adult === true) {
    throw new TmdbError('not-found', 404);
  }

  const original = nonEmptyText(
    movie ? body.original_title : body.original_name,
  );
  const date = nonEmptyText(movie ? body.release_date : body.first_air_date);
  const episodeRuntime = Array.isArray(body.episode_run_time)
    ? body.episode_run_time[0]
    : undefined;
  const voteCount = positiveNumber(body.vote_count);

  return {
    type,
    id: body.id,
    title,
    originalTitle: original !== title ? original : undefined,
    tagline: nonEmptyText(body.tagline),
    overview: nonEmptyText(body.overview),
    date: date && DATE.test(date) ? date : undefined,
    runtime: movie
      ? positiveNumber(body.runtime)
      : (positiveNumber(episodeRuntime) ??
        positiveNumber(body.last_episode_to_air?.runtime)),
    seasons: movie ? undefined : positiveNumber(body.number_of_seasons),
    episodes: movie ? undefined : positiveNumber(body.number_of_episodes),
    genres: objectArray(body.genres).flatMap((genre) =>
      typeof genre.id === 'number' && nonEmptyText(genre.name)
        ? [{ id: genre.id, name: genre.name as string }]
        : [],
    ),
    posterPath: nonEmptyText(body.poster_path),
    backdropPath: nonEmptyText(body.backdrop_path),
    voteAverage: voteCount ? positiveNumber(body.vote_average) : undefined,
    voteCount,
    // Movies have it in the page itself, tv shows only in external_ids.
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
  const v4BaseUrl = baseUrl.replace(/\/3$/, '/4');
  const timeoutMs = options.timeoutMs ?? 8000;
  const retries = options.retries ?? 2;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function request<T>(
    path: string,
    { params = {}, method, body, v4 = false, userToken }: RequestOptions = {},
  ): Promise<T> {
    const credential = userToken ?? options.getCredential();

    if (!credential) {
      throw new TmdbError('missing-credential');
    }

    const url = new URL(`${v4 ? v4BaseUrl : baseUrl}${path}`);
    const headers: Record<string, string> = { Accept: 'application/json' };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, String(value));
    }

    // A read access token goes in the header, a v3 key in the query string.
    if (isJwt(credential)) {
      headers.Authorization = `Bearer ${credential}`;
    } else {
      url.searchParams.set('api_key', credential);
    }

    for (let attempt = 0; ; attempt += 1) {
      let response: FetchResponse;

      try {
        response = await options.fetch(url.toString(), {
          ...(method ? { method } : {}),
          ...(body ? { body: JSON.stringify(body) } : {}),
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        // Never the url in the message: it may hold the key or a session.
        throw new TmdbError(isTimeout(error) ? 'timeout' : 'network');
      }

      if (response.status === 429 && attempt < retries) {
        await sleep(retryDelayMs(response.headers.get('Retry-After')));
        continue;
      }

      if (!response.ok) {
        const { message, tmdbStatus } = await readError(response);

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

  /**
   * Revokes the session and/or the user's access token at TMDB. Both are
   * tried even if one fails; the first failure is thrown.
   */
  async function deleteSession({
    sessionId,
    accessToken,
  }: Partial<Access>): Promise<void> {
    const results = await Promise.allSettled([
      sessionId &&
        request('/authentication/session', {
          method: 'DELETE',
          body: { session_id: sessionId },
        }),
      accessToken &&
        request('/auth/access_token', {
          method: 'DELETE',
          body: { access_token: accessToken },
          v4: true,
        }),
    ]);
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (failed) {
      throw failed.reason;
    }
  }

  return {
    async search(search: SearchRequest): Promise<Paged<SearchItem>> {
      const body = await request<SearchBody>(`/search/${search.type}`, {
        params: {
          query: search.query,
          page: search.page,
          language: search.language,
          include_adult: 'false',
        },
      });

      return toPaged(body, search.page, (item): SearchItem[] => {
        if (search.type !== 'multi') {
          return toTitles(item, search.type);
        }

        return item.media_type === 'person'
          ? toPeople(item)
          : toTitles(item, item.media_type);
      });
    },

    /** Country codes with watch providers, such as `BR`, sorted. */
    async regions(): Promise<string[]> {
      const body = await request<{ results?: unknown }>(
        '/watch/providers/regions',
      );
      const codes = objectArray(body.results)
        .map((region) => region.iso_3166_1)
        .filter(
          (code): code is string =>
            typeof code === 'string' && /^[A-Z]{2}$/.test(code),
        );

      return [...new Set(codes)].sort();
    },

    /** Movie and tv genres in one list, without repeated ids. */
    async genres(language: string): Promise<Genre[]> {
      const [movie, tv] = await Promise.all([
        request<GenreBody>('/genre/movie/list', { params: { language } }),
        request<GenreBody>('/genre/tv/list', { params: { language } }),
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

    /** The first page of a home page list, movies and tv shows only. */
    async list({ list, language }: ListRequest): Promise<MediaItem[]> {
      const { path, type } = LISTS[list];
      const body = await request<{ results?: JsonObject[] }>(path, {
        params: { language },
      });

      return (body.results ?? []).flatMap((item) =>
        toTitles(item, type ?? item.media_type),
      );
    },

    /** The page of a title, with cast, trailer and where to watch. */
    async details(details: DetailsRequest): Promise<MediaDetails> {
      const baseLanguage = details.language.slice(0, 2);
      // TMDB only sends videos in the requested language unless told which
      // others to add, and pt-BR does not match pt.
      const videoLanguages = new Set([
        details.language,
        baseLanguage,
        `${baseLanguage}-${details.region}`,
        'en',
        'null',
      ]);
      const body = await request<DetailsBody>(
        `/${details.type}/${details.id}`,
        {
          params: {
            language: details.language,
            append_to_response: 'credits,videos,watch/providers,external_ids',
            include_video_language: [...videoLanguages].join(','),
          },
        },
      );

      return toDetails(body, details);
    },

    /**
     * A request token for the user to approve. With the app's read access
     * token it is v4 (keeps `redirectTo`, lasts 15 minutes); with a v3 key
     * it lasts 60 and the redirect goes in the approval url (login.ts).
     */
    async createRequestToken(redirectTo?: string): Promise<string> {
      const body = isJwt(options.getCredential() ?? '')
        ? await request<JsonObject>('/auth/request_token', {
            method: 'POST',
            body: redirectTo ? { redirect_to: redirectTo } : {},
            v4: true,
          })
        : await request<JsonObject>('/authentication/token/new');

      return nonEmptyText(body.request_token) ?? invalidResponse();
    },

    /**
     * Trades an approved request token, once. A v4 token becomes the user's
     * access token, then a v3 session made from it. An unapproved or spent
     * token fails with `status_code` 17 (v3) or 41 (v4).
     */
    async createSession(requestToken: string): Promise<Access> {
      if (!isJwt(requestToken)) {
        const body = await request<JsonObject>('/authentication/session/new', {
          method: 'POST',
          body: { request_token: requestToken },
        });

        return {
          sessionId: nonEmptyText(body.session_id) ?? invalidResponse(),
        };
      }

      const user = await request<JsonObject>('/auth/access_token', {
        method: 'POST',
        body: { request_token: requestToken },
        v4: true,
      });
      const accessToken = nonEmptyText(user.access_token);
      const accountObjectId = nonEmptyText(user.account_id);

      if (!accessToken || !accountObjectId) {
        return invalidResponse();
      }

      try {
        const body = await request<JsonObject>(
          '/authentication/session/convert/4',
          { method: 'POST', body: { access_token: accessToken } },
        );

        return {
          sessionId: nonEmptyText(body.session_id) ?? invalidResponse(),
          accessToken,
          accountObjectId,
        };
      } catch (error) {
        // Useless without the session, so it is revoked.
        await deleteSession({ accessToken }).catch(() => {});

        throw error;
      }
    },

    async accountStates(
      sessionId: string,
      { type, id }: TitleRequest,
    ): Promise<TitleStates> {
      const body = await request<JsonObject>(`/${type}/${id}/account_states`, {
        params: { session_id: sessionId },
      });

      if (
        typeof body.watchlist !== 'boolean' ||
        typeof body.favorite !== 'boolean'
      ) {
        return invalidResponse();
      }

      // TMDB says `rated: false` when there is no rating.
      const rated =
        typeof body.rated === 'object' && body.rated !== null
          ? toRating((body.rated as JsonObject).value)
          : undefined;

      return {
        watchlist: body.watchlist,
        favorite: body.favorite,
        rated: rated ?? null,
      };
    },

    /** `null` removes the rating. TMDB also takes a rated title out of the watchlist. */
    async rate(
      sessionId: string,
      { type, id, value }: RateRequest,
    ): Promise<void> {
      await request(`/${type}/${id}/rating`, {
        params: { session_id: sessionId },
        ...(value === null
          ? { method: 'DELETE' }
          : { method: 'POST', body: { value } }),
      });
    },

    async mark(
      sessionId: string,
      accountId: number,
      { list, type, id, value }: MarkRequest,
    ): Promise<void> {
      await request(`/account/${accountId}/${list}`, {
        params: { session_id: sessionId },
        method: 'POST',
        body: { media_type: type, media_id: id, [list]: value },
      });
    },

    /** Last added (or rated) first; rated titles carry their rating. */
    async accountList(
      sessionId: string,
      accountId: number,
      { list, type, page, language }: AccountListRequest,
    ): Promise<Paged<MediaItem>> {
      const body = await request<SearchBody>(
        `/account/${accountId}/${list}/${type === 'movie' ? 'movies' : 'tv'}`,
        {
          params: {
            session_id: sessionId,
            page,
            language,
            sort_by: 'created_at.desc',
          },
        },
      );

      return toPaged(body, page, (item) =>
        toTitles(item, type).map((title) => {
          const rating = list === 'rated' ? toRating(item.rating) : undefined;

          return rating === undefined ? title : { ...title, rating };
        }),
      );
    },

    /** Fails with 401 when the session is over. */
    async account(sessionId: string): Promise<Account> {
      return toAccount(
        await request<AccountBody>('/account', {
          params: { session_id: sessionId },
        }),
      );
    },

    deleteSession,

    async userLists(
      accessToken: string,
      accountObjectId: string,
      page: number,
    ): Promise<{ lists: UserList[]; totalPages: number }> {
      const body = await request<SearchBody>(
        `/account/${encodeURIComponent(accountObjectId)}/lists`,
        { params: { page }, v4: true, userToken: accessToken },
      );

      return {
        lists: objectArray(body.results).flatMap((list) =>
          typeof list.id === 'number'
            ? [
                {
                  id: list.id,
                  name: typeof list.name === 'string' ? list.name : '',
                  description:
                    typeof list.description === 'string'
                      ? list.description
                      : '',
                },
              ]
            : [],
        ),
        totalPages: body.total_pages ?? 1,
      };
    },

    /** TMDB ignores `public: false` here (2026-11-16): see `updateList`. */
    async createList(
      accessToken: string,
      {
        name,
        description,
        language,
      }: Omit<UserList, 'id'> & { language: string },
    ): Promise<number> {
      const [lang, country] = language.split('-');
      const body = await request<JsonObject>('/list', {
        method: 'POST',
        body: {
          name,
          description,
          iso_639_1: lang,
          ...(country ? { iso_3166_1: country } : {}),
          public: false,
        },
        v4: true,
        userToken: accessToken,
      });

      return typeof body.id === 'number' ? body.id : invalidResponse();
    },

    /** Makes the list private, last added first. TMDB wants the full body. */
    async updateList(
      accessToken: string,
      listId: number,
      { name, description }: Omit<UserList, 'id'>,
    ): Promise<void> {
      await request(`/list/${listId}`, {
        method: 'PUT',
        body: {
          name,
          description,
          public: false,
          sort_by: 'original_order.desc',
        },
        v4: true,
        userToken: accessToken,
      });
    },

    async listItemStatus(
      accessToken: string,
      listId: number,
      { type, id }: TitleRequest,
    ): Promise<boolean> {
      try {
        const body = await request<JsonObject>(`/list/${listId}/item_status`, {
          params: { media_id: id, media_type: type },
          v4: true,
          userToken: accessToken,
        });

        return (
          body.success === true &&
          (body.media_id === undefined || Number(body.media_id) === id)
        );
      } catch (error) {
        // 404: not in the list, or no list at all.
        if (error instanceof TmdbError && error.code === 'not-found') {
          return false;
        }

        throw error;
      }
    },

    /** The comment is a second request: if it fails, the title stays without it. */
    async addToList(
      accessToken: string,
      listId: number,
      { type, id }: TitleRequest,
      comment: string,
    ): Promise<void> {
      const item = { media_type: type, media_id: id };
      const user = { v4: true, userToken: accessToken };

      await request(`/list/${listId}/items`, {
        method: 'POST',
        body: { items: [item] },
        ...user,
      });
      await request(`/list/${listId}/items`, {
        method: 'PUT',
        body: { items: [{ ...item, comment }] },
        ...user,
      }).catch(() => {});
    },

    async removeFromList(
      accessToken: string,
      listId: number,
      { type, id }: TitleRequest,
    ): Promise<void> {
      await request(`/list/${listId}/items`, {
        method: 'DELETE',
        body: { items: [{ media_type: type, media_id: id }] },
        v4: true,
        userToken: accessToken,
      });
    },

    /** In list order; a comment that is a date becomes `watchedAt`. */
    async listItems(
      accessToken: string,
      listId: number,
      page: number,
      language: string,
    ): Promise<Paged<MediaItem>> {
      const body = await request<SearchBody & { comments?: unknown }>(
        `/list/${listId}`,
        { params: { page, language }, v4: true, userToken: accessToken },
      );
      const comments: JsonObject =
        typeof body.comments === 'object' && body.comments !== null
          ? (body.comments as JsonObject)
          : {};

      return toPaged(body, page, (item) =>
        toTitles(item, item.media_type).map((title) => {
          const comment = comments[`${title.media_type}:${title.id}`];

          return typeof comment === 'string' && DATE.test(comment)
            ? { ...title, watchedAt: comment }
            : title;
        }),
      );
    },
  };
}

export type TmdbClient = ReturnType<typeof createTmdbClient>;
