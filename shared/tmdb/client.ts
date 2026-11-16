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

/** How many of the cast the page of a title shows. */
export const CAST_SIZE = 12;

/** How many of the titles someone is known for a search shows. */
export const KNOWN_FOR_SIZE = 3;

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
  results?: Fields[];
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

/**
 * What signing in gives. With the access token of the app (v4) the user
 * signs in through TMDB v4, which also gives their own access token, the
 * one their lists take; with a key (v3), only the session.
 */
export interface Access {
  /** TMDB's v3 session_id: the watchlist, the favorites and the ratings. */
  sessionId: string;
  /** The v4 access token of the user: a password of the account too. */
  accessToken?: string;
  /** The id of the account in v4, such as "5f0c...": not the v3 number. */
  accountObjectId?: string;
}

/** A v4 request token is a JWT, in three parts; a v3 one is plain hex. */
export const isV4RequestToken = (token: string) =>
  token.split('.').length === 3;

/** What a request that changes something at TMDB sends. */
type Send = {
  method: 'POST' | 'DELETE';
  body?: Record<string, string | number | boolean>;
};

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

/** A rating TMDB takes, such as 8.5; nothing else is one. */
const toRating = (value: unknown) =>
  typeof value === 'number' && RATINGS.includes(value) ? value : undefined;

const objects = (value: unknown): Fields[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Fields => typeof entry === 'object' && entry !== null,
      )
    : [];

/**
 * A movie or tv show of a list or a search, tagged with its type. Nothing
 * when it is something else, has no id, or is an adult title.
 */
function toTitles(item: Fields, type: unknown): MediaItem[] {
  return (type === 'movie' || type === 'tv') &&
    typeof item.id === 'number' &&
    item.adult !== true
    ? [toMediaItem(item as MediaItem & Fields, type)]
    : [];
}

/** A page of results, with the totals TMDB allows to page through. */
function toPaged<T>(
  body: SearchBody,
  page: number,
  read: (item: Fields) => T[],
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

/** Someone a search of everything found, with what they are known for. */
function toPeople(item: Fields): PersonItem[] {
  const name = text(item.name);

  if (typeof item.id !== 'number' || !name || item.adult === true) {
    return [];
  }

  return [
    {
      id: item.id,
      media_type: 'person',
      name,
      profile_path: text(item.profile_path),
      known_for: objects(item.known_for)
        .flatMap((title) => toTitles(title, title.media_type))
        .slice(0, KNOWN_FOR_SIZE),
    },
  ];
}

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
  // The same address, with v4 in place of v3.
  const v4BaseUrl = baseUrl.replace(/\/3$/, '/4');
  const timeoutMs = options.timeoutMs ?? 8000;
  const retries = options.retries ?? 2;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function request<T>(
    path: string,
    params: Record<string, string | number>,
    send?: Send,
    version: 3 | 4 = 3,
  ): Promise<T> {
    const credential = options.getCredential();

    if (!credential) {
      throw new TmdbError('missing-credential');
    }

    const url = new URL(`${version === 4 ? v4BaseUrl : baseUrl}${path}`);
    const headers: Record<string, string> = { Accept: 'application/json' };
    const content = !send
      ? {}
      : send.body
        ? { method: send.method, body: JSON.stringify(send.body) }
        : { method: send.method };

    if (send?.body) {
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

  /**
   * Ends at TMDB the session, the access token of the user, or both. Both
   * are asked even when one fails, which is then what this throws.
   */
  async function end({
    sessionId,
    accessToken,
  }: Partial<Access>): Promise<void> {
    const ended = await Promise.allSettled([
      sessionId &&
        request(
          '/authentication/session',
          {},
          { method: 'DELETE', body: { session_id: sessionId } },
        ),
      accessToken &&
        request(
          '/auth/access_token',
          {},
          { method: 'DELETE', body: { access_token: accessToken } },
          4,
        ),
    ]);
    const failed = ended.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (failed) {
      throw failed.reason;
    }
  }

  return {
    /**
     * A page of movies, of tv shows, or of everything (`multi`), where each
     * result says what it is and people are found too.
     */
    async search(search: SearchRequest): Promise<Paged<SearchItem>> {
      const body = await request<SearchBody>(`/search/${search.type}`, {
        query: search.query,
        page: search.page,
        language: search.language,
        include_adult: 'false',
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
      const body = await request<{ results?: Fields[] }>(path, { language });

      return (body.results ?? []).flatMap((item) =>
        toTitles(item, type ?? item.media_type),
      );
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
     * website. With the access token of the app it is a v4 one, which keeps
     * `redirectTo` itself and lasts 15 minutes; with a key, a v3 one, which
     * lasts 60 and takes `redirectTo` in the address of the approval page
     * (login.ts).
     */
    async createRequestToken(redirectTo?: string): Promise<string> {
      const body = isAccessToken(options.getCredential() ?? '')
        ? await request<Fields>(
            '/auth/request_token',
            {},
            {
              method: 'POST',
              body: redirectTo ? { redirect_to: redirectTo } : {},
            },
            4,
          )
        : await request<Fields>('/authentication/token/new', {});

      return text(body.request_token) ?? unreadable();
    },

    /**
     * Trades an approved request token for what signing in gives, once. A
     * v4 token becomes the access token of the user, then a v3 session made
     * from it. TMDB refuses a token that was not approved (or was already
     * traded) with `status_code` 17 in v3 and 41 in v4.
     */
    async createSession(requestToken: string): Promise<Access> {
      if (!isV4RequestToken(requestToken)) {
        const body = await request<Fields>(
          '/authentication/session/new',
          {},
          { method: 'POST', body: { request_token: requestToken } },
        );

        return { sessionId: text(body.session_id) ?? unreadable() };
      }

      const user = await request<Fields>(
        '/auth/access_token',
        {},
        { method: 'POST', body: { request_token: requestToken } },
        4,
      );
      const accessToken = text(user.access_token);
      const accountObjectId = text(user.account_id);

      if (!accessToken || !accountObjectId) {
        return unreadable();
      }

      try {
        const body = await request<Fields>(
          '/authentication/session/convert/4',
          {},
          { method: 'POST', body: { access_token: accessToken } },
        );

        return {
          sessionId: text(body.session_id) ?? unreadable(),
          accessToken,
          accountObjectId,
        };
      } catch (error) {
        // Of no use without the session: TMDB is told to forget it too.
        await end({ accessToken }).catch(() => {});

        throw error;
      }
    },

    /**
     * Whether a title is in the watchlist and in the favorites of a session,
     * and the rating it gave: TMDB says `rated: false` for none.
     */
    async accountStates(
      sessionId: string,
      { type, id }: TitleRequest,
    ): Promise<TitleStates> {
      const body = await request<Fields>(`/${type}/${id}/account_states`, {
        session_id: sessionId,
      });

      if (
        typeof body.watchlist !== 'boolean' ||
        typeof body.favorite !== 'boolean'
      ) {
        return unreadable();
      }

      const rated =
        typeof body.rated === 'object' && body.rated !== null
          ? toRating((body.rated as Fields).value)
          : undefined;

      return {
        watchlist: body.watchlist,
        favorite: body.favorite,
        rated: rated ?? null,
      };
    },

    /**
     * Gives a title a rating, or takes it away (`null`). By default TMDB
     * also takes a title it rates out of the watchlist.
     */
    async rate(
      sessionId: string,
      { type, id, value }: RateRequest,
    ): Promise<void> {
      await request(
        `/${type}/${id}/rating`,
        { session_id: sessionId },
        value === null
          ? { method: 'DELETE' }
          : { method: 'POST', body: { value } },
      );
    },

    /** Puts a title in a list of the account, or takes it out. */
    async mark(
      sessionId: string,
      accountId: number,
      { list, type, id, value }: MarkRequest,
    ): Promise<void> {
      await request(
        `/account/${accountId}/${list}`,
        { session_id: sessionId },
        {
          method: 'POST',
          body: { media_type: type, media_id: id, [list]: value },
        },
      );
    },

    /**
     * A page of a list of the account, the titles added (or rated) last
     * first; in the rated titles, each with its rating. Adult titles are
     * left out, as everywhere else in the app.
     */
    async accountList(
      sessionId: string,
      accountId: number,
      { list, type, page, language }: AccountListRequest,
    ): Promise<Paged<MediaItem>> {
      const body = await request<SearchBody>(
        `/account/${accountId}/${list}/${type === 'movie' ? 'movies' : 'tv'}`,
        {
          session_id: sessionId,
          page,
          language,
          sort_by: 'created_at.desc',
        },
      );

      return toPaged(body, page, (item) =>
        toTitles(item, type).map((title) => {
          const rating = list === 'rated' ? toRating(item.rating) : undefined;

          return rating === undefined ? title : { ...title, rating };
        }),
      );
    },

    /** The account a session belongs to. 401 when the session is over. */
    async account(sessionId: string): Promise<Account> {
      return toAccount(
        await request<AccountBody>('/account', { session_id: sessionId }),
      );
    },

    /** Ends at TMDB what signing in gave: it stops working everywhere. */
    deleteSession: end,
  };
}

export type TmdbClient = ReturnType<typeof createTmdbClient>;
