import {
  MIN_VOTES,
  RATINGS,
  TMDB_PAGE_SIZE,
  type Account,
  type AccountListRequest,
  type CastMember,
  type Certification,
  type DetailsRequest,
  type DiscoverFilters,
  type DiscoverFiltersRequest,
  type DiscoverRequest,
  type DiscoverSort,
  type Genre,
  type ListRequest,
  type MediaDetails,
  type MediaItem,
  type MediaList,
  type MarkRequest,
  type MediaType,
  type Paged,
  type PersonDetails,
  type PersonItem,
  type PersonLinks,
  type PersonRequest,
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

/** The field of the day a title came out, as the discovery names it. */
const RELEASE_FIELD: Record<MediaType, string> = {
  movie: 'primary_release_date',
  tv: 'first_air_date',
};

const DISCOVER_ORDER: Record<DiscoverSort, Record<MediaType, string>> = {
  popularity: { movie: 'popularity.desc', tv: 'popularity.desc' },
  rating: { movie: 'vote_average.desc', tv: 'vote_average.desc' },
  newest: {
    movie: 'primary_release_date.desc',
    tv: 'first_air_date.desc',
  },
};

/**
 * The newest first are the ones already out that some people saw: by date
 * alone, TMDB starts with titles announced for 2099, then with dozens a
 * day that nobody rated.
 */
export const NEWEST_MIN_VOTES = 10;

/** The lists of age ratings change about once a year. */
const AGE_RATINGS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const LANGUAGE_CODE = /^[a-z]{2}$/;

/** "No language", for silent movies and the like: not a language to pick. */
const NO_LANGUAGE = 'xx';

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

type CertificationsBody = { certifications?: Record<string, unknown> };

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
  release_dates?: { results?: unknown } | null;
  content_ratings?: { results?: unknown } | null;
};

type PersonBody = {
  id?: unknown;
  adult?: unknown;
  name?: unknown;
  known_for_department?: unknown;
  biography?: unknown;
  birthday?: unknown;
  deathday?: unknown;
  place_of_birth?: unknown;
  profile_path?: unknown;
  homepage?: unknown;
  imdb_id?: unknown;
  external_ids?: Record<string, unknown> | null;
  translations?: { translations?: unknown } | null;
  combined_credits?: { cast?: unknown; crew?: unknown } | null;
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

/** The order of JustWatch among every country. */
const displayPriority = (provider: JsonObject) =>
  typeof provider.display_priority === 'number'
    ? provider.display_priority
    : Number.MAX_SAFE_INTEGER;

/** The providers of the given lists, without repeats, in JustWatch order. */
function toProviders(
  lists: unknown[],
  rank: (provider: JsonObject) => number = displayPriority,
): WatchProvider[] {
  const seen = new Set<number>();

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
    stream: toProviders([flatrate]),
    free: toProviders([free, ads]),
    rent: toProviders([rent]),
    buy: toProviders([buy]),
  };
  const providerCount =
    options.stream.length +
    options.free.length +
    options.rent.length +
    options.buy.length;

  return providerCount > 0 ? options : undefined;
}

/** Where a fallback rating comes from: the country TMDB knows best. */
const FALLBACK_COUNTRY = 'US';

/** Theatrical, then limited theatrical: the release a rating is made for. */
const THEATRICAL_RELEASES = [3, 2];

/** A code to show. "NR" (not rated) says there is none. */
const ratingCode = (value: unknown) => {
  const code = nonEmptyText(value)?.trim();

  return code && code !== 'NR' && code.length <= 12 ? code : undefined;
};

/**
 * A movie is rated once per release (in theaters, on a streaming service,
 * on disc): the rating of the theaters first, then any rating given.
 */
function releaseCertification(country: JsonObject): string | undefined {
  const rank = (release: JsonObject) => {
    const index = THEATRICAL_RELEASES.indexOf(release.type as number);

    return index === -1 ? THEATRICAL_RELEASES.length : index;
  };

  return objectArray(country.release_dates)
    .filter((release) => ratingCode(release.certification))
    .sort((a, b) => rank(a) - rank(b))
    .map((release) => ratingCode(release.certification))[0];
}

/** The rating in `region`, or else in the United States. */
function toCertification(
  body: DetailsBody,
  movie: boolean,
  region: string,
): Certification | undefined {
  const countries = objectArray(
    movie ? body.release_dates?.results : body.content_ratings?.results,
  );

  for (const country of new Set([region, FALLBACK_COUNTRY])) {
    const entry = countries.find((item) => item.iso_3166_1 === country);
    const code =
      entry && (movie ? releaseCertification(entry) : ratingCode(entry.rating));

    if (code) {
      return { country, code };
    }
  }

  return undefined;
}

/** The genres with an id and a name, each once. */
function toGenres(genres: Partial<Genre>[]): Genre[] {
  const byId = new Map<number, Genre>();

  for (const genre of genres) {
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
}

/** The services of a country, in the order JustWatch has them there. */
function toRegionProviders(results: unknown, region: string) {
  return toProviders([results], (provider) => {
    const priorities = provider.display_priorities;
    const own =
      typeof priorities === 'object' && priorities !== null
        ? (priorities as JsonObject)[region]
        : undefined;

    // Those without an order there go last, in the order of every country.
    return typeof own === 'number' ? own : 1000 + displayPriority(provider);
  });
}

/** The age ratings of a country, the mildest first, without "NR". */
function toAgeRatings(body: CertificationsBody, region: string): string[] {
  const list = body.certifications?.[region];
  const codes = objectArray(list)
    .filter((rating) => typeof rating.order === 'number')
    .sort((a, b) => (a.order as number) - (b.order as number))
    .map((rating) => ratingCode(rating.certification))
    .filter((code) => code !== undefined);

  return [...new Set(codes)];
}

/** The codes of the original languages, without "no language". */
function toLanguages(body: unknown): string[] {
  const codes = objectArray(body)
    .map((language) => language.iso_639_1)
    .filter(
      (code): code is string =>
        typeof code === 'string' &&
        LANGUAGE_CODE.test(code) &&
        code !== NO_LANGUAGE,
    );

  return [...new Set(codes)].sort();
}

/** Today as YYYY-MM-DD, in UTC. */
const today = () => new Date().toISOString().slice(0, 10);

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
    certification: toCertification(body, movie, region),
  };
}

/** Talk shows and the news: someone there is a guest, not in a role. */
const TALK_AND_NEWS = [10767, 10763];

/** The order of what someone did on a title, behind the camera. */
const DEPARTMENTS = [
  'Directing',
  'Writing',
  'Creator',
  'Production',
  'Editing',
  'Camera',
  'Sound',
  'Art',
  'Costume & Make-Up',
  'Visual Effects',
  'Lighting',
  'Crew',
];

/** A name on a social network: letters, digits, dots and underscores. */
const HANDLE = /^[\w.]{1,64}$/;
const IMDB_PERSON = /^nm\d{5,10}$/;

interface Credit {
  item: MediaItem;
  votes: number;
  talk: boolean;
  roles: string[];
}

/**
 * Each title once, with every role in it, the best known first: by votes,
 * which popularity is not (talk shows are popular this week), with talk
 * shows and the news last.
 */
function toCredits(
  list: unknown,
  roleOf: (credit: JsonObject) => string | undefined,
): Credit[] {
  const byTitle = new Map<string, Credit>();

  for (const credit of objectArray(list)) {
    const [item] = toTitles(credit, credit.media_type);

    if (!item) {
      continue;
    }

    const key = `${item.media_type}-${item.id}`;
    let entry = byTitle.get(key);

    if (!entry) {
      const genres = Array.isArray(credit.genre_ids) ? credit.genre_ids : [];

      entry = {
        item,
        votes: positiveNumber(credit.vote_count) ?? 0,
        talk: TALK_AND_NEWS.some((genre) => genres.includes(genre)),
        roles: [],
      };
      byTitle.set(key, entry);
    }

    const role = roleOf(credit);

    if (role && !entry.roles.includes(role)) {
      entry.roles.push(role);
    }
  }

  return [...byTitle.values()].sort(
    (a, b) => Number(a.talk) - Number(b.talk) || b.votes - a.votes,
  );
}

/** The departments in the order of DEPARTMENTS, any other last. */
function departmentOrder(a: string, b: string) {
  const rank = (department: string) => {
    const index = DEPARTMENTS.indexOf(department);

    return index === -1 ? DEPARTMENTS.length : index;
  };

  return rank(a) - rank(b);
}

/**
 * In the language asked for, or another country's version of it (pt-PT
 * for pt-BR), or else in English, saying so.
 */
function pickBiography(
  body: PersonBody,
  language: string,
): Pick<PersonDetails, 'biography' | 'biographyLanguage'> {
  const own = nonEmptyText(body.biography)?.trim();

  if (own) {
    return { biography: own };
  }

  const base = language.slice(0, 2);
  const biographies = objectArray(body.translations?.translations).flatMap(
    (entry) => {
      const data = entry.data;
      const text =
        typeof data === 'object' && data !== null
          ? nonEmptyText((data as JsonObject).biography)?.trim()
          : undefined;

      return text && typeof entry.iso_639_1 === 'string'
        ? [{ language: entry.iso_639_1, country: entry.iso_3166_1, text }]
        : [];
    },
  );
  const same = biographies.find((entry) => entry.language === base);

  if (same) {
    return { biography: same.text };
  }

  const english =
    biographies.find(
      (entry) => entry.language === 'en' && entry.country === 'US',
    ) ?? biographies.find((entry) => entry.language === 'en');

  return english
    ? { biography: english.text, biographyLanguage: 'en' }
    : { biography: undefined };
}

function toHomepage(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) {
    return undefined;
  }

  try {
    return new URL(value).protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}

function toPersonLinks(body: PersonBody): PersonLinks {
  const ids = body.external_ids ?? {};
  const handle = (value: unknown) =>
    typeof value === 'string' && HANDLE.test(value) ? value : undefined;

  return {
    imdb: [body.imdb_id, ids.imdb_id].find(
      (id): id is string => typeof id === 'string' && IMDB_PERSON.test(id),
    ),
    instagram: handle(ids.instagram_id),
    x: handle(ids.twitter_id),
    facebook: handle(ids.facebook_id),
    tiktok: handle(ids.tiktok_id),
    homepage: toHomepage(body.homepage),
  };
}

function toPerson(body: PersonBody, language: string): PersonDetails {
  const name = nonEmptyText(body.name);

  if (typeof body.id !== 'number' || !name) {
    return invalidResponse();
  }

  // Searches leave adults out, so their pages are hidden too.
  if (body.adult === true) {
    throw new TmdbError('not-found', 404);
  }

  const date = (value: unknown) =>
    typeof value === 'string' && DATE.test(value) ? value : undefined;
  const credits = body.combined_credits;

  return {
    id: body.id,
    name,
    department: nonEmptyText(body.known_for_department),
    ...pickBiography(body, language),
    birthday: date(body.birthday),
    deathday: date(body.deathday),
    placeOfBirth: nonEmptyText(body.place_of_birth),
    profilePath: nonEmptyText(body.profile_path),
    links: toPersonLinks(body),
    cast: toCredits(credits?.cast, (credit) =>
      nonEmptyText(credit.character)?.trim(),
    ).map(({ item, roles }) =>
      roles.length ? { ...item, character: roles.join(' / ') } : item,
    ),
    crew: toCredits(credits?.crew, (credit) =>
      nonEmptyText(credit.department)?.trim(),
    ).map(({ item, roles }) => ({
      ...item,
      departments: roles.sort(departmentOrder),
    })),
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

  // The age ratings of every country, kept for a day: a discovery with
  // one needs them on every page.
  const ageRatingLists = new Map<
    MediaType,
    { savedAt: number; body: Promise<CertificationsBody> }
  >();

  function ageRatingList(type: MediaType): Promise<CertificationsBody> {
    const kept = ageRatingLists.get(type);

    if (kept && Date.now() - kept.savedAt < AGE_RATINGS_MAX_AGE_MS) {
      return kept.body;
    }

    const body = request<CertificationsBody>(`/certification/${type}/list`);

    ageRatingLists.set(type, { savedAt: Date.now(), body });
    // A failure is not kept: the next discovery asks again.
    body.catch(() => {
      if (ageRatingLists.get(type)?.body === body) {
        ageRatingLists.delete(type);
      }
    });

    return body;
  }

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
      const params: Record<string, string | number> = {
        query: search.query,
        page: search.page,
        language: search.language,
        include_adult: 'false',
      };

      // The year it came out: `year` would also take a tv show that had
      // episodes that year.
      if (search.year && search.type !== 'multi') {
        params[
          search.type === 'movie'
            ? 'primary_release_year'
            : 'first_air_date_year'
        ] = search.year;
      }

      const body = await request<SearchBody>(`/search/${search.type}`, {
        params,
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

      return toGenres([...(movie.genres ?? []), ...(tv.genres ?? [])]);
    },

    /**
     * Movies or tv shows that match every filter. Wherever the average
     * matters, only titles with enough votes for it (MIN_VOTES); the
     * newest are the ones already out.
     */
    async discover(discover: DiscoverRequest): Promise<Paged<MediaItem>> {
      const { type, page, region, sort, ageRating, providers } = discover;
      const field = RELEASE_FIELD[type];
      const params: Record<string, string | number> = {
        page,
        language: discover.language,
        include_adult: 'false',
        sort_by: DISCOVER_ORDER[sort][type],
      };
      const latest = [
        discover.toYear ? `${discover.toYear}-12-31` : undefined,
        sort === 'newest' ? today() : undefined,
      ]
        .filter((day) => day !== undefined)
        .sort()[0];

      if (discover.fromYear) {
        params[`${field}.gte`] = `${discover.fromYear}-01-01`;
      }

      if (latest) {
        params[`${field}.lte`] = latest;
      }

      if (discover.minRating) {
        params['vote_average.gte'] = discover.minRating;
      }

      if (discover.minRating || sort === 'rating') {
        params['vote_count.gte'] = MIN_VOTES[type];
      } else if (sort === 'newest') {
        params['vote_count.gte'] = NEWEST_MIN_VOTES;
      }

      // A comma asks for all the genres, a bar for any of the services.
      if (discover.genres?.length) {
        params.with_genres = discover.genres.join(',');
      }

      if (discover.originalLanguage) {
        params.with_original_language = discover.originalLanguage;
      }

      // That rating and the milder ones, by name: "up to" (certification.lte)
      // would also take the titles rated "NR", most of them in the US.
      if (ageRating) {
        const ratings = toAgeRatings(await ageRatingList(type), region);
        const index = ratings.indexOf(ageRating);

        if (index !== -1) {
          params.certification_country = region;
          params.certification = ratings.slice(0, index + 1).join('|');
        }
      }

      // Without the country, TMDB ignores the services.
      if (providers?.length) {
        params.watch_region = region;
        params.with_watch_providers = providers.join('|');
      }

      const body = await request<SearchBody>(`/discover/${type}`, { params });

      return toPaged(body, page, (item) => toTitles(item, type));
    },

    /** The genres, services, age ratings and languages to filter by. */
    async discoverFilters({
      type,
      language,
      region,
    }: DiscoverFiltersRequest): Promise<DiscoverFilters> {
      const [genres, providers, ageRatings, languages] = await Promise.all([
        request<GenreBody>(`/genre/${type}/list`, { params: { language } }),
        request<{ results?: unknown }>(`/watch/providers/${type}`, {
          params: { language, watch_region: region },
        }),
        ageRatingList(type),
        request<unknown>('/configuration/languages'),
      ]);

      return {
        genres: toGenres(genres.genres ?? []),
        providers: toRegionProviders(providers.results, region),
        ageRatings: toAgeRatings(ageRatings, region),
        languages: toLanguages(languages),
      };
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

    /**
     * The page of a title, with cast, trailer, where to watch and the age
     * rating.
     */
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
            append_to_response: [
              'credits',
              'videos',
              'watch/providers',
              'external_ids',
              // movies are rated per release, tv shows once per country
              details.type === 'movie' ? 'release_dates' : 'content_ratings',
            ].join(','),
            include_video_language: [...videoLanguages].join(','),
          },
        },
      );

      return toDetails(body, details);
    },

    /**
     * The page of a person, with what they did. The biographies in every
     * language come along, for one in English when there is none in the
     * language asked for.
     */
    async person({ id, language }: PersonRequest): Promise<PersonDetails> {
      const body = await request<PersonBody>(`/person/${id}`, {
        params: {
          language,
          append_to_response: 'combined_credits,external_ids,translations',
        },
      });

      return toPerson(body, language);
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
