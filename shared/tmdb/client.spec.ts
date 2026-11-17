// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { TMDB_PAGE_SIZE } from '../api';
import {
  CAST_SIZE,
  createTmdbClient,
  KNOWN_FOR_SIZE,
  TMDB_MAX_PAGES,
  TmdbError,
  type FetchLike,
} from './client';

const V3_KEY = '0123456789abcdef0123456789abcdef';
const V4_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJ4In0.c2lnbmF0dXJl';

function answer(status: number, body: unknown, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function setup(
  responses: Array<Response | Error>,
  options: { credential?: string | null; baseUrl?: string } = {},
) {
  const fetch = vi.fn<FetchLike>(async () => {
    const next = responses.shift();

    if (!next) throw new Error('unexpected request');
    if (next instanceof Error) throw next;

    return next;
  });
  const sleep = vi.fn(async () => {});
  const client = createTmdbClient({
    getCredential: () =>
      options.credential === undefined ? V3_KEY : options.credential,
    fetch,
    sleep,
    baseUrl: options.baseUrl,
  });
  const requestedUrl = (call = 0) => new URL(fetch.mock.calls[call][0]);

  return { client, fetch, sleep, requestedUrl };
}

const search = {
  type: 'movie',
  query: 'matrix',
  page: 1,
  language: 'en',
} as const;

const page = {
  page: 1,
  results: [{ id: 603, title: 'The Matrix', popularity: 99, adult: false }],
  total_pages: 3,
  total_results: 45,
};

describe('credentials', () => {
  it('does not call TMDB without a key', async () => {
    const { client, fetch } = setup([], { credential: null });

    await expect(client.search(search)).rejects.toMatchObject({
      code: 'missing-credential',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends a v3 key in the query string', async () => {
    const { client, fetch, requestedUrl } = setup([answer(200, page)]);

    await client.search(search);

    expect(requestedUrl().searchParams.get('api_key')).toBe(V3_KEY);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('sends a v4 access token in the Authorization header', async () => {
    const { client, fetch, requestedUrl } = setup([answer(200, page)], {
      credential: V4_TOKEN,
    });

    await client.search(search);

    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(
      `Bearer ${V4_TOKEN}`,
    );
    expect(requestedUrl().searchParams.has('api_key')).toBe(false);
  });
});

describe('search', () => {
  it('asks the endpoint of the media type with an encoded query', async () => {
    const { client, requestedUrl } = setup([answer(200, page)]);

    await client.search({
      type: 'tv',
      query: 'tom & jerry #1',
      page: 2,
      language: 'pt-BR',
    });

    const url = requestedUrl();
    expect(url.origin + url.pathname).toBe(
      'https://api.themoviedb.org/3/search/tv',
    );
    expect(url.searchParams.get('query')).toBe('tom & jerry #1');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('language')).toBe('pt-BR');
    expect(url.searchParams.get('include_adult')).toBe('false');
  });

  it('returns the page with only the fields the app uses', async () => {
    const { client } = setup([answer(200, page)]);

    await expect(client.search(search)).resolves.toEqual({
      page: 1,
      results: [{ id: 603, media_type: 'movie', title: 'The Matrix' }],
      totalPages: 3,
      totalResults: 45,
    });
  });

  it('caps the totals at the last page TMDB accepts', async () => {
    const { client } = setup([
      answer(200, { ...page, total_pages: 900, total_results: 18000 }),
    ]);

    await expect(client.search(search)).resolves.toMatchObject({
      totalPages: TMDB_MAX_PAGES,
      totalResults: TMDB_MAX_PAGES * TMDB_PAGE_SIZE,
    });
  });

  it('uses another base url when one is given', async () => {
    const { client, requestedUrl } = setup([answer(200, page)], {
      baseUrl: 'http://127.0.0.1:4010/3/',
    });

    await client.search(search);

    expect(requestedUrl().href).toMatch(
      /^http:\/\/127\.0\.0\.1:4010\/3\/search\/movie\?/,
    );
  });

  it('leaves out an adult title and one without an id', async () => {
    const { client } = setup([
      answer(200, {
        ...page,
        results: [
          ...page.results,
          { id: 7, title: 'For adults', adult: true },
          { title: 'Without an id' },
        ],
      }),
    ]);

    await expect(client.search(search)).resolves.toMatchObject({
      results: [{ id: 603, media_type: 'movie', title: 'The Matrix' }],
    });
  });
});

describe('search of everything', () => {
  const keanu = {
    adult: false,
    id: 6384,
    name: 'Keanu Reeves',
    original_name: 'Keanu Reeves',
    gender: 2,
    known_for_department: 'Acting',
    profile_path: '/keanu.jpg',
    popularity: 30,
    media_type: 'person',
    known_for: [
      {
        id: 603,
        media_type: 'movie',
        title: 'The Matrix',
        release_date: '1999-03-31',
        overview: 'Not shown',
      },
      { id: 1396, media_type: 'tv', name: 'Breaking Bad' },
      { id: 8, media_type: 'movie', title: 'For adults', adult: true },
      { id: 245891, media_type: 'movie', title: 'John Wick' },
      { id: 324552, media_type: 'movie', title: 'John Wick: Chapter 2' },
    ],
  };

  it('asks the multi endpoint, which also finds people', async () => {
    const { client, requestedUrl } = setup([answer(200, page)]);

    await client.search({ ...search, type: 'multi' });

    expect(requestedUrl().pathname).toBe('/3/search/multi');
    expect(requestedUrl().searchParams.get('include_adult')).toBe('false');
  });

  it('keeps movies, tv shows and people, each saying what it is', async () => {
    const { client } = setup([
      answer(200, {
        ...page,
        results: [
          { id: 603, media_type: 'movie', title: 'The Matrix', popularity: 9 },
          { id: 1396, media_type: 'tv', name: 'Breaking Bad' },
          keanu,
          { id: 9, media_type: 'collection', name: 'Not a title' },
          { id: 10, media_type: 'person', name: 'For adults', adult: true },
          { id: 11, media_type: 'person', name: '' },
          { media_type: 'tv', name: 'Without an id' },
        ],
      }),
    ]);

    const { results } = await client.search({ ...search, type: 'multi' });

    expect(results).toEqual([
      { id: 603, media_type: 'movie', title: 'The Matrix' },
      { id: 1396, media_type: 'tv', name: 'Breaking Bad' },
      {
        id: 6384,
        media_type: 'person',
        name: 'Keanu Reeves',
        profile_path: '/keanu.jpg',
        known_for: [
          {
            id: 603,
            media_type: 'movie',
            title: 'The Matrix',
            release_date: '1999-03-31',
          },
          { id: 1396, media_type: 'tv', name: 'Breaking Bad' },
          { id: 245891, media_type: 'movie', title: 'John Wick' },
        ],
      },
    ]);
    expect(KNOWN_FOR_SIZE).toBe(3);
  });

  it('keeps someone without a picture or anything known', async () => {
    const { client } = setup([
      answer(200, {
        ...page,
        results: [
          { id: 1, media_type: 'person', name: 'Someone', profile_path: null },
        ],
      }),
    ]);

    await expect(
      client.search({ ...search, type: 'multi' }),
    ).resolves.toMatchObject({
      results: [
        { id: 1, media_type: 'person', name: 'Someone', known_for: [] },
      ],
    });
  });
});

describe('failures', () => {
  it.each([
    [401, 'unauthorized'],
    [404, 'not-found'],
    [422, 'invalid-request'],
    [503, 'server'],
  ])('maps status %i to %s', async (status, code) => {
    const { client } = setup([
      answer(status, { status_message: 'Explained by TMDB' }),
    ]);

    const error = await client.search(search).catch((thrown) => thrown);

    expect(error).toBeInstanceOf(TmdbError);
    expect(error).toMatchObject({
      code,
      status,
      message: 'Explained by TMDB',
    });
  });

  it('waits and retries when TMDB asks to slow down', async () => {
    const { client, fetch, sleep } = setup([
      answer(429, {}, { 'Retry-After': '2' }),
      answer(200, page),
    ]);

    await expect(client.search(search)).resolves.toMatchObject({ page: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('gives up after the allowed retries', async () => {
    const { client, fetch } = setup([
      answer(429, {}),
      answer(429, {}),
      answer(429, {}),
    ]);

    await expect(client.search(search)).rejects.toMatchObject({
      code: 'rate-limited',
      status: 429,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('reports a connection failure without leaking the key', async () => {
    const { client } = setup([
      new TypeError(`fetch failed for ?api_key=${V3_KEY}`),
    ]);

    const error = await client.search(search).catch((thrown) => thrown);

    expect(error).toMatchObject({ code: 'network' });
    expect(error.message).not.toContain(V3_KEY);
  });

  it('reports a timeout', async () => {
    const { client } = setup([
      new DOMException('The operation timed out', 'TimeoutError'),
    ]);

    await expect(client.search(search)).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('reports an answer that is not json', async () => {
    const { client } = setup([new Response('<html>', { status: 200 })]);

    await expect(client.search(search)).rejects.toMatchObject({
      code: 'server',
    });
  });
});

describe('regions', () => {
  it('reads the countries where TMDB knows where to watch, each once, sorted', async () => {
    const { client, requestedUrl } = setup([
      answer(200, {
        results: [
          { iso_3166_1: 'US', english_name: 'United States' },
          { iso_3166_1: 'BR', english_name: 'Brazil' },
          { iso_3166_1: 'BR', english_name: 'Brazil' },
          { iso_3166_1: '419', english_name: 'Latin America' },
          { english_name: 'Nowhere' },
        ],
      }),
    ]);

    await expect(client.regions()).resolves.toEqual(['BR', 'US']);
    expect(requestedUrl().pathname).toBe('/3/watch/providers/regions');
  });
});

describe('genres', () => {
  it('merges the movie and tv lists without repeating ids', async () => {
    const { client, requestedUrl } = setup([
      answer(200, {
        genres: [
          { id: 28, name: 'Ação' },
          { id: 18, name: 'Drama' },
        ],
      }),
      answer(200, {
        genres: [
          { id: 18, name: 'Drama' },
          { id: 10759, name: 'Action & Adventure' },
          { id: 99, name: null },
        ],
      }),
    ]);

    await expect(client.genres('pt-BR')).resolves.toEqual([
      { id: 28, name: 'Ação' },
      { id: 18, name: 'Drama' },
      { id: 10759, name: 'Action & Adventure' },
    ]);
    expect(requestedUrl(0).pathname).toBe('/3/genre/movie/list');
    expect(requestedUrl(1).pathname).toBe('/3/genre/tv/list');
    expect(requestedUrl(0).searchParams.get('language')).toBe('pt-BR');
  });
});

describe('lists of the home page', () => {
  it.each([
    ['trending', '/3/trending/all/week'],
    ['popular-movies', '/3/movie/popular'],
    ['popular-tv', '/3/tv/popular'],
  ] as const)('asks TMDB for %s', async (list, path) => {
    const { client, requestedUrl } = setup([answer(200, { results: [] })]);

    await client.list({ list, language: 'pt-BR' });

    expect(requestedUrl().pathname).toBe(path);
    expect(requestedUrl().searchParams.get('language')).toBe('pt-BR');
  });

  it('keeps the movies and tv shows of the trending list, tagged', async () => {
    const { client } = setup([
      answer(200, {
        page: 1,
        results: [
          { id: 603, media_type: 'movie', title: 'Matrix', popularity: 9 },
          { id: 1396, media_type: 'tv', name: 'Breaking Bad' },
          { id: 6384, media_type: 'person', name: 'Keanu Reeves' },
          { id: 7, media_type: 'movie', title: 'For adults', adult: true },
          { media_type: 'movie', title: 'Without an id' },
        ],
      }),
    ]);

    await expect(
      client.list({ list: 'trending', language: 'en' }),
    ).resolves.toEqual([
      { id: 603, media_type: 'movie', title: 'Matrix' },
      { id: 1396, media_type: 'tv', name: 'Breaking Bad' },
    ]);
  });

  it('tags every title of a popular list with its type', async () => {
    const { client } = setup([
      answer(200, { results: [{ id: 1396, name: 'Breaking Bad' }] }),
    ]);

    await expect(
      client.list({ list: 'popular-tv', language: 'en' }),
    ).resolves.toEqual([{ id: 1396, media_type: 'tv', name: 'Breaking Bad' }]);
  });
});

describe('details', () => {
  const movie = {
    id: 603,
    adult: false,
    title: 'Matrix',
    original_title: 'The Matrix',
    tagline: 'Bem-vindo ao mundo real.',
    overview: 'Um hacker descobre a verdade sobre a sua realidade.',
    release_date: '1999-03-31',
    runtime: 136,
    budget: 63000000,
    genres: [{ id: 28, name: 'Ação' }, { id: 'x' }],
    poster_path: '/matrix.jpg',
    vote_average: 8.2,
    vote_count: 26000,
    imdb_id: 'tt0133093',
    credits: {
      cast: [
        {
          id: 6384,
          name: 'Keanu Reeves',
          character: 'Neo',
          profile_path: '/k.jpg',
          popularity: 50,
        },
        { id: 2975, name: 'Laurence Fishburne', character: '' },
        { name: 'Someone without an id' },
      ],
      crew: [{ id: 1, name: 'Lana Wachowski', job: 'Director' }],
    },
    videos: {
      results: [
        { key: 'vimeo123456', site: 'Vimeo', type: 'Trailer', iso_639_1: 'pt' },
        {
          key: 'teaserPT001',
          site: 'YouTube',
          type: 'Teaser',
          iso_639_1: 'pt',
        },
        {
          key: 'trailerEN01',
          site: 'YouTube',
          type: 'Trailer',
          iso_639_1: 'en',
          official: true,
          name: 'Official Trailer',
        },
        {
          key: 'trailerPT01',
          site: 'YouTube',
          type: 'Trailer',
          iso_639_1: 'pt',
          name: 'Trailer Legendado',
        },
        {
          key: 'not a key!',
          site: 'YouTube',
          type: 'Trailer',
          iso_639_1: 'pt',
        },
        { key: 'making0f001', site: 'YouTube', type: 'Featurette' },
      ],
    },
    'watch/providers': {
      results: {
        BR: {
          link: 'https://www.themoviedb.org/movie/603-the-matrix/watch?locale=BR',
          flatrate: [
            { provider_id: 1899, provider_name: 'Max', display_priority: 3 },
            {
              provider_id: 8,
              provider_name: 'Netflix',
              logo_path: '/netflix.png',
              display_priority: 1,
            },
          ],
          rent: [{ provider_id: 2, provider_name: 'Apple TV' }],
          buy: [{ provider_id: 2, provider_name: 'Apple TV' }],
          ads: [{ provider_id: 300, provider_name: 'Pluto TV' }],
          free: [
            { provider_id: 300, provider_name: 'Pluto TV' },
            { provider_name: 'A service without an id' },
          ],
        },
        US: { flatrate: [{ provider_id: 9, provider_name: 'Prime Video' }] },
      },
    },
    external_ids: { imdb_id: 'tt0133093', facebook_id: null },
  };

  const show = {
    id: 1396,
    name: 'Breaking Bad',
    original_name: 'Breaking Bad',
    first_air_date: '2008-01-20',
    episode_run_time: [],
    last_episode_to_air: { runtime: 47 },
    number_of_seasons: 5,
    number_of_episodes: 62,
    genres: [{ id: 18, name: 'Drama' }],
    poster_path: null,
    vote_average: 8.9,
    vote_count: 15000,
    external_ids: { imdb_id: 'tt0903747' },
    credits: { cast: [] },
    videos: { results: [] },
    'watch/providers': { results: {} },
  };

  const inBrazil = {
    type: 'movie',
    id: 603,
    language: 'pt-BR',
    region: 'BR',
  } as const;

  /** The movie, with other places to watch it in Brazil. */
  const watchInBrazil = (brazil: Record<string, unknown>) => ({
    ...movie,
    'watch/providers': { results: { BR: brazil } },
  });

  it('asks for the page with everything it shows in one request', async () => {
    const { client, requestedUrl } = setup([answer(200, movie)]);

    await client.details(inBrazil);

    const url = requestedUrl();
    expect(url.origin + url.pathname).toBe(
      'https://api.themoviedb.org/3/movie/603',
    );
    expect(url.searchParams.get('language')).toBe('pt-BR');
    expect(url.searchParams.get('append_to_response')).toBe(
      'credits,videos,watch/providers,external_ids',
    );
    // pt-BR and pt are not the same to TMDB: videos in either, then English
    expect(url.searchParams.get('include_video_language')).toBe(
      'pt-BR,pt,en,null',
    );
  });

  it('keeps only what the page shows, with where to watch in the region', async () => {
    const { client } = setup([answer(200, movie)]);

    await expect(client.details(inBrazil)).resolves.toEqual({
      type: 'movie',
      id: 603,
      title: 'Matrix',
      originalTitle: 'The Matrix',
      tagline: 'Bem-vindo ao mundo real.',
      overview: 'Um hacker descobre a verdade sobre a sua realidade.',
      date: '1999-03-31',
      runtime: 136,
      genres: [{ id: 28, name: 'Ação' }],
      posterPath: '/matrix.jpg',
      voteAverage: 8.2,
      voteCount: 26000,
      imdbId: 'tt0133093',
      // in the language of the app before English, a trailer before a teaser
      trailer: { key: 'trailerPT01', name: 'Trailer Legendado' },
      cast: [
        {
          id: 6384,
          name: 'Keanu Reeves',
          character: 'Neo',
          profilePath: '/k.jpg',
        },
        { id: 2975, name: 'Laurence Fishburne' },
      ],
      watch: {
        link: 'https://www.themoviedb.org/movie/603-the-matrix/watch?locale=BR',
        // in the order JustWatch ranks them, each service once
        stream: [
          { id: 8, name: 'Netflix', logoPath: '/netflix.png' },
          { id: 1899, name: 'Max' },
        ],
        free: [{ id: 300, name: 'Pluto TV' }],
        rent: [{ id: 2, name: 'Apple TV' }],
        buy: [{ id: 2, name: 'Apple TV' }],
      },
    });
  });

  it('reads a tv show, whose IMDb id is only in its external ids', async () => {
    const { client, requestedUrl } = setup([answer(200, show)]);

    await expect(
      client.details({ type: 'tv', id: 1396, language: 'en', region: 'US' }),
    ).resolves.toEqual({
      type: 'tv',
      id: 1396,
      title: 'Breaking Bad',
      date: '2008-01-20',
      // TMDB often leaves episode_run_time empty
      runtime: 47,
      seasons: 5,
      episodes: 62,
      genres: [{ id: 18, name: 'Drama' }],
      voteAverage: 8.9,
      voteCount: 15000,
      imdbId: 'tt0903747',
      cast: [],
    });
    expect(requestedUrl().pathname).toBe('/3/tv/1396');
    expect(requestedUrl().searchParams.get('include_video_language')).toBe(
      'en,en-US,null',
    );
  });

  it('has nowhere to watch in a region JustWatch knows nothing about', async () => {
    const { client } = setup([answer(200, movie)]);

    const details = await client.details({ ...inBrazil, region: 'PT' });

    expect(details.watch).toBeUndefined();
  });

  it('drops a link that does not go to TMDB', async () => {
    const { client } = setup([
      answer(
        200,
        watchInBrazil({
          link: 'https://elsewhere.test/watch',
          flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
        }),
      ),
    ]);

    await expect(client.details(inBrazil)).resolves.toMatchObject({
      watch: { link: undefined, stream: [{ id: 8, name: 'Netflix' }] },
    });
  });

  it('has nothing to show when no service offers the title', async () => {
    const { client } = setup([
      answer(
        200,
        watchInBrazil({
          link: 'https://www.themoviedb.org/movie/603-the-matrix/watch',
          flatrate: [],
        }),
      ),
    ]);

    const details = await client.details(inBrazil);

    expect(details.watch).toBeUndefined();
  });

  it(`shows the first ${CAST_SIZE} of the cast`, async () => {
    const cast = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      name: `Actor ${index + 1}`,
    }));
    const { client } = setup([answer(200, { ...movie, credits: { cast } })]);

    const details = await client.details(inBrazil);

    expect(details.cast).toHaveLength(CAST_SIZE);
    expect(details.cast[0].name).toBe('Actor 1');
  });

  it('does not show an adult title, which no search would list', async () => {
    const { client } = setup([answer(200, { ...movie, adult: true })]);

    await expect(client.details(inBrazil)).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('reports a title TMDB does not have', async () => {
    const { client } = setup([
      answer(404, { status_code: 34, status_message: 'Not found.' }),
    ]);

    await expect(client.details(inBrazil)).rejects.toMatchObject({
      code: 'not-found',
      status: 404,
    });
  });

  it('reports an answer without a title as unreadable', async () => {
    const { client } = setup([answer(200, { ...movie, title: '' })]);

    await expect(client.details(inBrazil)).rejects.toMatchObject({
      code: 'server',
    });
  });
});

describe('lists of the account', () => {
  const SESSION = 'the-session-id-works-as-a-password';

  it('reads whether a title is in the watchlist and in the favorites', async () => {
    const { client, requestedUrl } = setup([
      answer(200, { id: 1396, favorite: true, rated: false, watchlist: false }),
    ]);

    await expect(
      client.accountStates(SESSION, { type: 'tv', id: 1396 }),
    ).resolves.toEqual({ watchlist: false, favorite: true, rated: null });
    expect(requestedUrl().pathname).toBe('/3/tv/1396/account_states');
    expect(requestedUrl().searchParams.get('session_id')).toBe(SESSION);
  });

  it.each([
    ['a rating', { value: 8.5 }, 8.5],
    ['a rating without its half', { value: 9.0 }, 9],
    ['no rating', false, null],
    ['a rating TMDB does not take', { value: 11 }, null],
    ['something else', 'eight', null],
  ])('reads %s of a title', async (_case, rated, rating) => {
    const { client } = setup([
      answer(200, { id: 603, favorite: false, rated, watchlist: true }),
    ]);

    await expect(
      client.accountStates(SESSION, { type: 'movie', id: 603 }),
    ).resolves.toEqual({ watchlist: true, favorite: false, rated: rating });
  });

  it('rates a title', async () => {
    const { client, fetch, requestedUrl } = setup([
      answer(201, { status_code: 1, status_message: 'Success.' }),
    ]);

    await client.rate(SESSION, { type: 'tv', id: 1396, value: 7.5 });

    const init = fetch.mock.calls[0][1];
    expect(requestedUrl().pathname).toBe('/3/tv/1396/rating');
    expect(requestedUrl().searchParams.get('session_id')).toBe(SESSION);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body!)).toEqual({ value: 7.5 });
  });

  it('takes the rating of a title away', async () => {
    const { client, fetch, requestedUrl } = setup([
      answer(200, {
        status_code: 13,
        status_message: 'The item/record was deleted successfully.',
      }),
    ]);

    await client.rate(SESSION, { type: 'movie', id: 603, value: null });

    const init = fetch.mock.calls[0][1];
    expect(requestedUrl().pathname).toBe('/3/movie/603/rating');
    expect(requestedUrl().searchParams.get('session_id')).toBe(SESSION);
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('reads the rated titles, each with its rating', async () => {
    const { client, requestedUrl } = setup([
      answer(200, {
        page: 1,
        results: [
          { id: 1396, name: 'Breaking Bad', rating: 10.0 },
          { id: 1399, name: 'Game of Thrones', rating: 'ten' },
        ],
        total_pages: 1,
        total_results: 2,
      }),
    ]);

    await expect(
      client.accountList(SESSION, 7, {
        list: 'rated',
        type: 'tv',
        page: 1,
        language: 'en',
      }),
    ).resolves.toEqual({
      page: 1,
      results: [
        { id: 1396, media_type: 'tv', name: 'Breaking Bad', rating: 10 },
        // a rating that is not one is left out, not the title
        { id: 1399, media_type: 'tv', name: 'Game of Thrones' },
      ],
      totalPages: 1,
      totalResults: 2,
    });
    expect(requestedUrl().pathname).toBe('/3/account/7/rated/tv');
    expect(requestedUrl().searchParams.get('sort_by')).toBe('created_at.desc');
  });

  it('keeps a rating out of the other lists', async () => {
    const { client } = setup([
      answer(200, {
        page: 1,
        results: [{ id: 603, title: 'The Matrix', rating: 8 }],
        total_pages: 1,
        total_results: 1,
      }),
    ]);

    const { results } = await client.accountList(SESSION, 7, {
      list: 'favorite',
      type: 'movie',
      page: 1,
      language: 'en',
    });

    expect(results[0]).not.toHaveProperty('rating');
  });

  it('reports an answer without the states as unreadable', async () => {
    const { client } = setup([answer(200, { id: 603 })]);

    await expect(
      client.accountStates(SESSION, { type: 'movie', id: 603 }),
    ).rejects.toMatchObject({ code: 'server' });
  });

  it.each([
    ['watchlist', true],
    ['favorite', false],
  ] as const)(
    'puts a title in the %s, or takes it out',
    async (list, value) => {
      const { client, fetch, requestedUrl } = setup([
        answer(201, { status_code: 1, status_message: 'Success.' }),
      ]);

      await client.mark(SESSION, 7, { list, type: 'movie', id: 603, value });

      const init = fetch.mock.calls[0][1];
      expect(requestedUrl().pathname).toBe(`/3/account/7/${list}`);
      expect(requestedUrl().searchParams.get('session_id')).toBe(SESSION);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body!)).toEqual({
        media_type: 'movie',
        media_id: 603,
        [list]: value,
      });
    },
  );

  it.each([
    ['movie', '/3/account/7/watchlist/movies'],
    ['tv', '/3/account/7/watchlist/tv'],
  ] as const)(
    'reads a page of the %s of a list, the last added first',
    async (type, path) => {
      const { client, requestedUrl } = setup([
        answer(200, {
          page: 2,
          results: [
            { id: 603, title: 'The Matrix', name: undefined },
            { id: 7, title: 'For adults', adult: true },
          ],
          total_pages: 2,
          total_results: 22,
        }),
      ]);

      await expect(
        client.accountList(SESSION, 7, {
          list: 'watchlist',
          type,
          page: 2,
          language: 'pt-BR',
        }),
      ).resolves.toEqual({
        page: 2,
        results: [{ id: 603, media_type: type, title: 'The Matrix' }],
        totalPages: 2,
        totalResults: 22,
      });
      expect(requestedUrl().pathname).toBe(path);
      expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({
        session_id: SESSION,
        page: '2',
        language: 'pt-BR',
        sort_by: 'created_at.desc',
        api_key: V3_KEY,
      });
    },
  );

  it('tells a session that is over by what TMDB says', async () => {
    const { client } = setup([
      answer(401, {
        success: false,
        status_code: 3,
        status_message: 'Authentication failed.',
      }),
    ]);

    await expect(
      client.accountStates(SESSION, { type: 'movie', id: 603 }),
    ).rejects.toMatchObject({ code: 'unauthorized', tmdbStatus: 3 });
  });
});

describe('lists of the user (v4)', () => {
  const USER = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.dXNlcg';
  const MATRIX = { type: 'movie', id: 603 } as const;

  /** With a key of the app, so a request with the token of the user shows. */
  const asked = (fetch: ReturnType<typeof setup>['fetch'], call = 0) => {
    const [url, init] = fetch.mock.calls[call];

    return {
      url: new URL(url),
      method: init.method ?? 'GET',
      body: init.body ? JSON.parse(init.body) : undefined,
      authorization: init.headers.Authorization,
    };
  };

  it('reads the lists of the user with their token, never with the key of the app', async () => {
    const { client, fetch } = setup([
      answer(200, {
        page: 2,
        results: [
          { id: 5, name: 'Noir', description: 'Old films', public: 0 },
          { name: 'no id' },
        ],
        total_pages: 3,
      }),
    ]);

    await expect(client.userLists(USER, 'abc123', 2)).resolves.toEqual({
      lists: [{ id: 5, name: 'Noir', description: 'Old films' }],
      totalPages: 3,
    });

    const request = asked(fetch);
    expect(request.url.pathname).toBe('/4/account/abc123/lists');
    expect(request.url.searchParams.get('page')).toBe('2');
    expect(request.url.searchParams.has('api_key')).toBe(false);
    expect(request.authorization).toBe(`Bearer ${USER}`);
  });

  it('makes a list, asking for it private', async () => {
    const { client, fetch } = setup([
      answer(201, { success: true, status_code: 1, id: 88 }),
    ]);

    await expect(
      client.createList(USER, {
        name: 'Assistidos',
        description: 'Media App',
        language: 'pt-BR',
      }),
    ).resolves.toBe(88);

    expect(fetch).toHaveBeenCalledOnce();
    expect(asked(fetch)).toMatchObject({
      method: 'POST',
      body: {
        name: 'Assistidos',
        description: 'Media App',
        iso_639_1: 'pt',
        iso_3166_1: 'BR',
        public: false,
      },
    });
    expect(asked(fetch).url.pathname).toBe('/4/list');
  });

  it('makes a list private and sorts it by the last added first, with the whole list', async () => {
    // TMDB makes a list public whatever `public` said when it was made
    const { client, fetch } = setup([
      answer(201, { success: true, status_code: 12 }),
    ]);

    await client.updateList(USER, 88, {
      name: 'Assistidos',
      description: 'Media App',
    });

    expect(asked(fetch)).toMatchObject({
      method: 'PUT',
      body: {
        name: 'Assistidos',
        description: 'Media App',
        public: false,
        sort_by: 'original_order.desc',
      },
      authorization: `Bearer ${USER}`,
    });
    expect(asked(fetch).url.pathname).toBe('/4/list/88');
  });

  it.each([
    [
      'in the list',
      () => answer(200, { success: true, status_code: 1, media_id: 603 }),
      true,
    ],
    ['not in it, as a 404', () => answer(404, { status_code: 34 }), false],
    ['not in it, as a failure', () => answer(200, { success: false }), false],
  ])('tells a title that is %s', async (_case, response, inList) => {
    const { client, fetch } = setup([response()]);

    await expect(client.listItemStatus(USER, 77, MATRIX)).resolves.toBe(inList);

    const request = asked(fetch);
    expect(request.url.pathname).toBe('/4/list/77/item_status');
    expect(Object.fromEntries(request.url.searchParams)).toEqual({
      media_id: '603',
      media_type: 'movie',
    });
  });

  it('puts a title in a list, with the day in its comment', async () => {
    const { client, fetch } = setup([
      answer(200, { success: true, results: [] }),
      answer(200, { success: true, results: [] }),
    ]);

    await client.addToList(USER, 77, MATRIX, '2026-11-16');

    expect(asked(fetch, 0)).toMatchObject({
      method: 'POST',
      body: { items: [{ media_type: 'movie', media_id: 603 }] },
    });
    expect(asked(fetch, 1)).toMatchObject({
      method: 'PUT',
      body: {
        items: [{ media_type: 'movie', media_id: 603, comment: '2026-11-16' }],
      },
    });
    expect(asked(fetch, 1).url.pathname).toBe('/4/list/77/items');
  });

  it('keeps the title in the list when the comment fails', async () => {
    const { client } = setup([
      answer(200, { success: true }),
      answer(500, { status_code: 11 }),
    ]);

    await expect(
      client.addToList(USER, 77, MATRIX, '2026-11-16'),
    ).resolves.toBeUndefined();
  });

  it('takes a title out of a list', async () => {
    const { client, fetch } = setup([answer(200, { success: true })]);

    await client.removeFromList(USER, 77, { type: 'tv', id: 1396 });

    expect(asked(fetch)).toMatchObject({
      method: 'DELETE',
      body: { items: [{ media_type: 'tv', media_id: 1396 }] },
    });
  });

  it('reads a page of a list, movies and tv shows, each with the day it was watched', async () => {
    const { client, fetch } = setup([
      answer(200, {
        page: 1,
        results: [
          { id: 603, media_type: 'movie', title: 'The Matrix' },
          { id: 1396, media_type: 'tv', name: 'Breaking Bad' },
          { id: 31, media_type: 'person', name: 'Tom Hanks' },
        ],
        comments: { 'movie:603': '2026-11-16', 'tv:1396': 'great show' },
        total_pages: 1,
        total_results: 3,
      }),
    ]);

    await expect(client.listItems(USER, 77, 1, 'pt-BR')).resolves.toEqual({
      page: 1,
      results: [
        {
          id: 603,
          media_type: 'movie',
          title: 'The Matrix',
          watchedAt: '2026-11-16',
        },
        // a comment that is not a day is not one
        { id: 1396, media_type: 'tv', name: 'Breaking Bad' },
      ],
      totalPages: 1,
      totalResults: 3,
    });
    expect(Object.fromEntries(asked(fetch).url.searchParams)).toEqual({
      page: '1',
      language: 'pt-BR',
    });
  });
});

describe('signing in', () => {
  const REQUEST_TOKEN = 'a1b2c3d4e5f6';
  const SESSION = 'the-session-id-works-as-a-password';
  // What TMDB v4 hands out is a JWT, in three parts.
  const V4_REQUEST_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ2IjoxfQ.cmVxdWVzdA';
  const USER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.dXNlcg';
  const ACCOUNT_OBJECT = '5f0c4a1b2c3d4e5f6a7b8c9d';

  it('asks for a v3 request token with a key', async () => {
    const { client, fetch, requestedUrl } = setup([
      answer(200, {
        success: true,
        expires_at: '2026-11-14 18:00:00 UTC',
        request_token: REQUEST_TOKEN,
      }),
    ]);

    await expect(
      client.createRequestToken('http://127.0.0.1:5000/callback/x'),
    ).resolves.toBe(REQUEST_TOKEN);

    expect(requestedUrl().pathname).toBe('/3/authentication/token/new');
    expect(fetch.mock.calls[0][1].method).toBeUndefined();
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
  });

  it('asks for a v4 request token, with the way back, with the token of the app', async () => {
    const { client, fetch, requestedUrl } = setup(
      [
        answer(200, {
          success: true,
          status_code: 1,
          request_token: V4_REQUEST_TOKEN,
        }),
      ],
      { credential: V4_TOKEN },
    );

    await expect(
      client.createRequestToken('https://media-app.test/api/auth/callback'),
    ).resolves.toBe(V4_REQUEST_TOKEN);

    const init = fetch.mock.calls[0][1];
    expect(requestedUrl().href).toBe(
      'https://api.themoviedb.org/4/auth/request_token',
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body!)).toEqual({
      redirect_to: 'https://media-app.test/api/auth/callback',
    });
    expect(init.headers.Authorization).toBe(`Bearer ${V4_TOKEN}`);
  });

  it('asks v4 at the address of v3 given in place of the one of TMDB', async () => {
    const { client, requestedUrl } = setup(
      [answer(200, { request_token: V4_REQUEST_TOKEN })],
      { credential: V4_TOKEN, baseUrl: 'http://127.0.0.1:9999/3' },
    );

    await client.createRequestToken();

    expect(requestedUrl().href).toBe(
      'http://127.0.0.1:9999/4/auth/request_token',
    );
  });

  it('trades an approved v3 request token for a session', async () => {
    const { client, fetch, requestedUrl } = setup(
      [answer(200, { success: true, session_id: SESSION })],
      { credential: V4_TOKEN },
    );

    await expect(client.createSession(REQUEST_TOKEN)).resolves.toEqual({
      sessionId: SESSION,
    });

    const init = fetch.mock.calls[0][1];
    expect(requestedUrl().pathname).toBe('/3/authentication/session/new');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body!)).toEqual({ request_token: REQUEST_TOKEN });
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${V4_TOKEN}`,
      'Content-Type': 'application/json',
    });
  });

  it('trades an approved v4 request token for the access of the user and a session made from it', async () => {
    const { client, fetch, requestedUrl } = setup(
      [
        answer(200, {
          success: true,
          status_code: 1,
          access_token: USER_TOKEN,
          account_id: ACCOUNT_OBJECT,
        }),
        answer(200, { success: true, session_id: SESSION }),
      ],
      { credential: V4_TOKEN },
    );

    await expect(client.createSession(V4_REQUEST_TOKEN)).resolves.toEqual({
      sessionId: SESSION,
      accessToken: USER_TOKEN,
      accountObjectId: ACCOUNT_OBJECT,
    });

    expect(requestedUrl(0).pathname).toBe('/4/auth/access_token');
    expect(JSON.parse(fetch.mock.calls[0][1].body!)).toEqual({
      request_token: V4_REQUEST_TOKEN,
    });
    expect(requestedUrl(1).pathname).toBe(
      '/3/authentication/session/convert/4',
    );
    expect(JSON.parse(fetch.mock.calls[1][1].body!)).toEqual({
      access_token: USER_TOKEN,
    });
    // both with the token of the app, never the one of the user
    expect(
      fetch.mock.calls.map(([, init]) => init.headers.Authorization),
    ).toEqual([`Bearer ${V4_TOKEN}`, `Bearer ${V4_TOKEN}`]);
    for (const [url] of fetch.mock.calls) {
      expect(url).not.toContain(USER_TOKEN);
    }
  });

  it('ends the access of the user when TMDB will not make a session of it', async () => {
    const { client, fetch, requestedUrl } = setup(
      [
        answer(200, { access_token: USER_TOKEN, account_id: ACCOUNT_OBJECT }),
        answer(401, { status_code: 35, status_message: 'Invalid token.' }),
        answer(200, { success: true, status_code: 13 }),
      ],
      { credential: V4_TOKEN },
    );

    await expect(client.createSession(V4_REQUEST_TOKEN)).rejects.toMatchObject({
      code: 'unauthorized',
      tmdbStatus: 35,
    });

    expect(requestedUrl(2).pathname).toBe('/4/auth/access_token');
    expect(fetch.mock.calls[2][1].method).toBe('DELETE');
    expect(JSON.parse(fetch.mock.calls[2][1].body!)).toEqual({
      access_token: USER_TOKEN,
    });
  });

  it('says that a v4 request token is not approved, the way TMDB does', async () => {
    const { client } = setup(
      [
        answer(422, {
          success: false,
          status_code: 41,
          status_message:
            "This request token hasn't been approved by the user.",
        }),
      ],
      { credential: V4_TOKEN },
    );

    await expect(client.createSession(V4_REQUEST_TOKEN)).rejects.toMatchObject({
      status: 422,
      tmdbStatus: 41,
    });
  });

  it('tells a token that is not approved from a refused credential', async () => {
    const { client } = setup([
      answer(401, {
        success: false,
        status_code: 17,
        status_message: 'Session denied.',
      }),
      answer(401, {
        success: false,
        status_code: 7,
        status_message: 'Invalid API key: You must be granted a valid key.',
      }),
    ]);

    await expect(client.createSession(REQUEST_TOKEN)).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
      tmdbStatus: 17,
    });
    await expect(client.createSession(REQUEST_TOKEN)).rejects.toMatchObject({
      code: 'unauthorized',
      tmdbStatus: 7,
    });
  });

  it('reads the account of a session, keeping only what the app shows', async () => {
    const { client, requestedUrl } = setup([
      answer(200, {
        id: 7,
        username: 'ada',
        name: 'Ada Lovelace',
        include_adult: false,
        iso_639_1: 'en',
        iso_3166_1: 'GB',
        avatar: {
          gravatar: { hash: '0123456789abcdef' },
          tmdb: { avatar_path: '/ada.jpg' },
        },
      }),
    ]);

    await expect(client.account(SESSION)).resolves.toEqual({
      id: 7,
      username: 'ada',
      name: 'Ada Lovelace',
      avatarPath: '/ada.jpg',
    });
    expect(requestedUrl().pathname).toBe('/3/account');
    expect(requestedUrl().searchParams.get('session_id')).toBe(SESSION);
  });

  it('leaves out a name and a picture that the account does not have', async () => {
    const { client } = setup([
      answer(200, {
        id: 7,
        username: 'ada',
        name: '',
        avatar: { gravatar: { hash: null }, tmdb: { avatar_path: null } },
      }),
    ]);

    await expect(client.account(SESSION)).resolves.toEqual({
      id: 7,
      username: 'ada',
    });
  });

  it('reports a session that is over', async () => {
    const { client } = setup([
      answer(401, {
        success: false,
        status_code: 3,
        status_message: 'Authentication failed.',
      }),
    ]);

    await expect(client.account(SESSION)).rejects.toMatchObject({
      code: 'unauthorized',
      tmdbStatus: 3,
    });
  });

  it('ends a session', async () => {
    const { client, fetch, requestedUrl } = setup([
      answer(200, { success: true }),
    ]);

    await expect(
      client.deleteSession({ sessionId: SESSION }),
    ).resolves.toBeUndefined();

    const init = fetch.mock.calls[0][1];
    expect(fetch).toHaveBeenCalledOnce();
    expect(requestedUrl().pathname).toBe('/3/authentication/session');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body!)).toEqual({ session_id: SESSION });
    // not in the address, which is what ends up in logs
    expect(requestedUrl().search).not.toContain(SESSION);
  });

  it('ends the session and the access of the user, even when one fails', async () => {
    const { client, fetch } = setup(
      [
        answer(500, { status_code: 11 }),
        answer(200, { success: true, status_code: 13 }),
      ],
      { credential: V4_TOKEN },
    );

    await expect(
      client.deleteSession({ sessionId: SESSION, accessToken: USER_TOKEN }),
    ).rejects.toMatchObject({ code: 'server' });

    expect(
      fetch.mock.calls.map(([url, init]) => [
        new URL(url).pathname,
        init.method,
        JSON.parse(init.body!),
      ]),
    ).toEqual([
      ['/3/authentication/session', 'DELETE', { session_id: SESSION }],
      ['/4/auth/access_token', 'DELETE', { access_token: USER_TOKEN }],
    ]);
  });

  it.each([
    ['a request token', () => ({ success: true })],
    ['a session', () => ({ success: true, session_id: '' })],
    ['an account', () => ({ username: 'ada' })],
    ['the access of the user', () => ({ account_id: ACCOUNT_OBJECT })],
    ['the account in v4', () => ({ access_token: USER_TOKEN })],
  ] as const)('does not accept an answer without %s', async (what, body) => {
    const { client } = setup([answer(200, body())]);
    const ask = {
      'a request token': () => client.createRequestToken(),
      'a session': () => client.createSession(REQUEST_TOKEN),
      'an account': () => client.account(SESSION),
      'the access of the user': () => client.createSession(V4_REQUEST_TOKEN),
      'the account in v4': () => client.createSession(V4_REQUEST_TOKEN),
    }[what];

    await expect(ask()).rejects.toMatchObject({ code: 'server' });
  });

  it('does not put the session in the message of a connection failure', async () => {
    const { client } = setup([
      new TypeError(`fetch failed for /account?session_id=${SESSION}`),
    ]);

    const error = await client.account(SESSION).catch((thrown) => thrown);

    expect(error).toMatchObject({ code: 'network' });
    expect(error.message).not.toContain(SESSION);
  });
});
