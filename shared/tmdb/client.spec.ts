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

  it('keeps the synopsis of a title, for the list view, and not a blank one', async () => {
    const { client } = setup([
      answer(200, {
        ...page,
        results: [
          { id: 603, title: 'The Matrix', overview: 'A hacker learns.' },
          { id: 604, title: 'The Matrix Reloaded', overview: '  ' },
        ],
      }),
    ]);

    const { results } = await client.search(search);

    expect(
      results.map((item) => ('overview' in item ? item.overview : null)),
    ).toEqual(['A hacker learns.', undefined]);
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

  it('asks for the year a movie came out, or a tv show began', async () => {
    const { client, requestedUrl } = setup([
      answer(200, page),
      answer(200, page),
    ]);

    await client.search({ ...search, year: 1999 });
    await client.search({ ...search, type: 'tv', year: 2005 });

    expect(requestedUrl(0).searchParams.get('primary_release_year')).toBe(
      '1999',
    );
    expect(requestedUrl(0).searchParams.has('year')).toBe(false);
    expect(requestedUrl(1).searchParams.get('first_air_date_year')).toBe(
      '2005',
    );
  });
});

/** A client whose TMDB answers by path, such as `/discover/movie`. */
function setupByPath(bodies: Record<string, unknown>) {
  const fetch = vi.fn<FetchLike>(async (url) => {
    const path = new URL(url).pathname.replace(/^\/3/, '');

    if (!Object.hasOwn(bodies, path)) {
      throw new Error(`unexpected request to ${path}`);
    }

    return answer(200, bodies[path]);
  });
  const client = createTmdbClient({ getCredential: () => V3_KEY, fetch });
  const asked = (path: string) =>
    fetch.mock.calls
      .map(([url]) => new URL(url))
      .filter((url) => url.pathname === `/3${path}`);

  return { client, fetch, asked };
}

/** The query of a url, without the key. */
const paramsOf = (url: URL) => {
  const params = Object.fromEntries(url.searchParams);

  delete params.api_key;
  return params;
};

describe('discovery', () => {
  const discover = {
    type: 'movie',
    page: 1,
    language: 'pt-BR',
    region: 'BR',
    sort: 'popularity',
  } as const;
  const found = { ...page, results: [{ id: 603, title: 'The Matrix' }] };
  // Every country's ratings, in no order, as TMDB sends them.
  const ageRatings = {
    certifications: {
      US: [
        { certification: 'PG-13', order: 3 },
        { certification: 'NR', order: 0 },
        { certification: 'G', order: 1 },
        { certification: 'R', order: 4 },
        { certification: 'PG', order: 2 },
      ],
      BR: [
        { certification: '12', order: 3 },
        { certification: 'L', order: 1 },
        { certification: '10', order: 2 },
      ],
    },
  };

  it('asks for the popular titles of a type, leaving adult ones out', async () => {
    const { client, asked } = setupByPath({ '/discover/movie': found });

    await expect(client.discover(discover)).resolves.toEqual({
      page: 1,
      results: [{ id: 603, media_type: 'movie', title: 'The Matrix' }],
      totalPages: 3,
      totalResults: 45,
    });
    expect(paramsOf(asked('/discover/movie')[0])).toEqual({
      page: '1',
      language: 'pt-BR',
      include_adult: 'false',
      sort_by: 'popularity.desc',
    });
  });

  it('asks for every filter given, all of the genres and any of the services', async () => {
    const { client, asked } = setupByPath({ '/discover/tv': found });

    const { results } = await client.discover({
      ...discover,
      type: 'tv',
      page: 2,
      genres: [18, 80],
      fromYear: 1990,
      toYear: 1999,
      minRating: 7,
      originalLanguage: 'ko',
      providers: [8, 119],
    });

    expect(results[0].media_type).toBe('tv');
    expect(paramsOf(asked('/discover/tv')[0])).toEqual({
      page: '2',
      language: 'pt-BR',
      include_adult: 'false',
      sort_by: 'popularity.desc',
      with_genres: '18,80',
      'first_air_date.gte': '1990-01-01',
      'first_air_date.lte': '1999-12-31',
      'vote_average.gte': '7',
      // with fewer votes, the average does not tell much
      'vote_count.gte': '200',
      with_original_language: 'ko',
      watch_region: 'BR',
      with_watch_providers: '8|119',
    });
  });

  it('puts the best rated first only among titles with enough votes', async () => {
    const { client, asked } = setupByPath({ '/discover/movie': found });

    await client.discover({ ...discover, sort: 'rating' });

    expect(paramsOf(asked('/discover/movie')[0])).toMatchObject({
      sort_by: 'vote_average.desc',
      'vote_count.gte': '300',
    });
  });

  it('puts the newest first among those already out that some people saw', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));

    try {
      const { client, asked } = setupByPath({ '/discover/movie': found });

      await client.discover({ ...discover, sort: 'newest' });
      await client.discover({ ...discover, sort: 'newest', toYear: 1999 });

      const [now, nineties] = asked('/discover/movie').map(paramsOf);
      expect(now).toMatchObject({
        sort_by: 'primary_release_date.desc',
        'primary_release_date.lte': '2026-11-18',
        'vote_count.gte': '10',
      });
      expect(nineties['primary_release_date.lte']).toBe('1999-12-31');
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks for an age rating and the milder ones by name, never "NR"', async () => {
    const { client, asked } = setupByPath({
      '/discover/movie': found,
      '/certification/movie/list': ageRatings,
    });

    await client.discover({ ...discover, region: 'US', ageRating: 'PG-13' });
    await client.discover({ ...discover, region: 'BR', ageRating: '10' });

    const [american, brazilian] = asked('/discover/movie').map(paramsOf);
    expect(american).toMatchObject({
      certification_country: 'US',
      certification: 'G|PG|PG-13',
    });
    expect(brazilian).toMatchObject({
      certification_country: 'BR',
      certification: 'L|10',
    });
    // kept for the next pages
    expect(asked('/certification/movie/list')).toHaveLength(1);
  });

  it('leaves out an age rating the country does not have', async () => {
    const { client, asked } = setupByPath({
      '/discover/movie': found,
      '/certification/movie/list': ageRatings,
    });

    await client.discover({ ...discover, ageRating: 'PG-13' });

    expect(asked('/discover/movie')[0].searchParams.has('certification')).toBe(
      false,
    );
  });
});

describe('filters of a discovery', () => {
  it('brings the genres, services, age ratings and languages of a type in a country', async () => {
    const service = (id: number, name: string, inBrazil?: number) => ({
      provider_id: id,
      provider_name: name,
      logo_path: `/${id}.png`,
      display_priority: id,
      display_priorities: inBrazil === undefined ? { US: 1 } : { BR: inBrazil },
    });
    const { client, asked } = setupByPath({
      '/genre/tv/list': {
        genres: [
          { id: 18, name: 'Drama' },
          { id: 18, name: 'Drama again' },
          { name: 'Without an id' },
          { id: 10762, name: 'Kids' },
        ],
      },
      '/watch/providers/tv': {
        results: [
          service(307, 'Globoplay', 12),
          service(1, 'Elsewhere'),
          service(8, 'Netflix', 0),
          service(8, 'Netflix', 0),
          { provider_id: 9, provider_name: '' },
        ],
      },
      '/certification/tv/list': {
        certifications: {
          BR: [
            { certification: '10', order: 1 },
            { certification: 'L', order: 0 },
          ],
        },
      },
      '/configuration/languages': [
        { iso_639_1: 'ko', english_name: 'Korean' },
        { iso_639_1: 'xx', english_name: 'No Language' },
        { iso_639_1: 'en', english_name: 'English' },
        { iso_639_1: 'not a code' },
      ],
    });

    await expect(
      client.discoverFilters({ type: 'tv', language: 'pt-BR', region: 'BR' }),
    ).resolves.toEqual({
      genres: [
        { id: 18, name: 'Drama' },
        { id: 10762, name: 'Infantil' },
      ],
      providers: [
        { id: 8, name: 'Netflix', logoPath: '/8.png' },
        { id: 307, name: 'Globoplay', logoPath: '/307.png' },
        // without a place in the country: last
        { id: 1, name: 'Elsewhere', logoPath: '/1.png' },
      ],
      ageRatings: ['L', '10'],
      languages: ['en', 'ko'],
    });
    expect(paramsOf(asked('/genre/tv/list')[0])).toEqual({
      language: 'pt-BR',
    });
    expect(paramsOf(asked('/watch/providers/tv')[0])).toEqual({
      language: 'pt-BR',
      watch_region: 'BR',
    });
  });

  it('has no age ratings for a country without them', async () => {
    const { client } = setupByPath({
      '/genre/movie/list': { genres: [] },
      '/watch/providers/movie': { results: [] },
      '/certification/movie/list': { certifications: {} },
      '/configuration/languages': [],
    });

    await expect(
      client.discoverFilters({ type: 'movie', language: 'en', region: 'AQ' }),
    ).resolves.toMatchObject({ ageRatings: [], providers: [] });
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
      // TMDB has it only in English
      { id: 10759, name: 'Ação e aventura' },
    ]);
    expect(requestedUrl(0).pathname).toBe('/3/genre/movie/list');
    expect(requestedUrl(1).pathname).toBe('/3/genre/tv/list');
    expect(requestedUrl(0).searchParams.get('language')).toBe('pt-BR');
  });
});

describe('lists of the home page', () => {
  it.each([
    ['trending', '/3/trending/all/week'],
    ['trending-movies', '/3/trending/movie/week'],
    ['trending-tv', '/3/trending/tv/week'],
    ['popular-movies', '/3/movie/popular'],
    ['popular-tv', '/3/tv/popular'],
    ['now-playing', '/3/movie/now_playing'],
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

  it('asks for the movies in the theaters of a country', async () => {
    const { client, requestedUrl } = setup([
      answer(200, { results: [{ id: 1, title: 'In theaters' }] }),
    ]);

    await expect(
      client.list({ list: 'now-playing', language: 'pt-BR', region: 'BR' }),
    ).resolves.toEqual([{ id: 1, media_type: 'movie', title: 'In theaters' }]);
    expect(requestedUrl().searchParams.get('region')).toBe('BR');
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
    backdrop_path: '/matrix-wide.jpg',
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
    release_dates: {
      results: [
        {
          iso_3166_1: 'BR',
          release_dates: [
            { type: 1, certification: '', note: 'Festival do Rio' },
            { type: 5, certification: '14', note: 'Blu-ray' },
            { type: 3, certification: '12', note: '' },
          ],
        },
        {
          iso_3166_1: 'US',
          release_dates: [{ type: 3, certification: 'R', note: '' }],
        },
      ],
    },
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
    content_ratings: {
      results: [
        { iso_3166_1: 'BR', rating: '16', descriptors: [] },
        { iso_3166_1: 'US', rating: 'TV-MA', descriptors: [] },
      ],
    },
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
      'credits,videos,watch/providers,external_ids,release_dates',
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
      backdropPath: '/matrix-wide.jpg',
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
      // the rating of the release in theaters, not of the disc
      certification: { country: 'BR', code: '12' },
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
      certification: { country: 'US', code: 'TV-MA' },
    });
    expect(requestedUrl().pathname).toBe('/3/tv/1396');
    // a tv show is rated once per country, not per release
    expect(requestedUrl().searchParams.get('append_to_response')).toBe(
      'credits,videos,watch/providers,external_ids,content_ratings',
    );
    expect(requestedUrl().searchParams.get('include_video_language')).toBe(
      'en,en-US,null',
    );
  });

  it('names in the language the genres of a show TMDB left in English', async () => {
    const { client } = setup([
      answer(200, {
        ...show,
        genres: [
          { id: 18, name: 'Drama' },
          { id: 10765, name: 'Sci-Fi & Fantasy' },
        ],
      }),
    ]);

    const details = await client.details({
      type: 'tv',
      id: 1396,
      language: 'pt-BR',
      region: 'BR',
    });

    expect(details.genres).toEqual([
      { id: 18, name: 'Drama' },
      { id: 10765, name: 'Ficção científica e fantasia' },
    ]);
  });

  it('lists the seasons of a show in order, the specials last, and its episodes next and last', async () => {
    const { client } = setup([
      answer(200, {
        ...show,
        seasons: [
          { season_number: 2, name: 'Season 2', episode_count: 13 },
          {
            season_number: 0,
            name: 'Specials',
            episode_count: 9,
            air_date: '2009-02-17',
          },
          {
            season_number: 1,
            name: 'Season 1',
            episode_count: 7,
            air_date: '2008-01-20',
            poster_path: '/s1.jpg',
          },
          // announced, without episodes yet
          { season_number: 3, name: 'Season 3', episode_count: 0 },
          { name: 'Without a number', episode_count: 4 },
        ],
        last_episode_to_air: {
          season_number: 2,
          episode_number: 13,
          name: 'ABQ',
          air_date: '2009-05-31',
          runtime: 47,
        },
        next_episode_to_air: {
          season_number: 3,
          episode_number: 1,
          name: '',
          air_date: 'soon',
        },
      }),
    ]);

    const details = await client.details({
      type: 'tv',
      id: 1396,
      language: 'en',
      region: 'US',
    });

    expect(details.seasonList).toEqual([
      {
        number: 1,
        name: 'Season 1',
        episodeCount: 7,
        airDate: '2008-01-20',
        posterPath: '/s1.jpg',
      },
      { number: 2, name: 'Season 2', episodeCount: 13 },
      {
        number: 0,
        name: 'Specials',
        episodeCount: 9,
        airDate: '2009-02-17',
      },
    ]);
    expect(details.lastEpisode).toEqual({
      season: 2,
      number: 13,
      name: 'ABQ',
      airDate: '2009-05-31',
    });
    expect(details.nextEpisode).toEqual({ season: 3, number: 1 });
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

  it('rates a title as the United States do when the region has no rating', async () => {
    const { client } = setup([answer(200, movie), answer(200, show)]);

    await expect(
      client.details({ ...inBrazil, region: 'PT' }),
    ).resolves.toMatchObject({ certification: { country: 'US', code: 'R' } });
    await expect(
      client.details({ type: 'tv', id: 1396, language: 'pt', region: 'PT' }),
    ).resolves.toMatchObject({
      certification: { country: 'US', code: 'TV-MA' },
    });
  });

  it('takes any rating of a movie never released in theaters', async () => {
    const { client } = setup([
      answer(200, {
        ...movie,
        release_dates: {
          results: [
            {
              iso_3166_1: 'BR',
              release_dates: [
                { type: 4, certification: ' ', note: 'Netflix' },
                { type: 4, certification: 'L', note: 'Disney+' },
              ],
            },
          ],
        },
      }),
    ]);

    await expect(client.details(inBrazil)).resolves.toMatchObject({
      certification: { country: 'BR', code: 'L' },
    });
  });

  it.each([
    ['not rated', [{ iso_3166_1: 'US', rating: 'NR' }]],
    ['rated without a code', [{ iso_3166_1: 'BR', rating: '' }]],
    ['rated in other countries only', [{ iso_3166_1: 'DE', rating: '16' }]],
    ['given something else', [{ iso_3166_1: 'BR', rating: 14 }]],
  ])('has no rating for a title %s', async (_case, results) => {
    const { client } = setup([
      answer(200, { ...show, content_ratings: { results } }),
    ]);

    const details = await client.details({
      type: 'tv',
      id: 1396,
      language: 'pt-BR',
      region: 'BR',
    });

    expect(details.certification).toBeUndefined();
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

describe('season', () => {
  const episode = (number: number, overview: string, extra = {}) => ({
    episode_number: number,
    name: `Episode ${number}`,
    overview,
    air_date: '2008-01-20',
    runtime: 47,
    still_path: `/e${number}.jpg`,
    vote_average: 8.1,
    vote_count: 12,
    episode_type: 'standard',
    ...extra,
  });
  const season = (overview: string, episodes: unknown[]) => ({
    id: 3572,
    season_number: 1,
    name: 'Temporada 1',
    overview,
    air_date: '2008-01-20',
    poster_path: '/s1.jpg',
    episodes,
  });

  it('brings the episodes, completing in English the synopses it lacks', async () => {
    const { client, requestedUrl } = setup([
      answer(
        200,
        season('', [
          episode(2, '', { name: '', episode_type: 'finale' }),
          episode(1, 'Walter recebe um diagnóstico.'),
          { name: 'Without a number' },
        ]),
      ),
      answer(
        200,
        season('Walter White learns he is ill.', [
          episode(1, 'Walter gets a diagnosis.'),
          episode(2, 'Walt and Jesse clean up.'),
        ]),
      ),
    ]);

    await expect(
      client.season({ id: 1396, season: 1, language: 'pt-BR' }),
    ).resolves.toEqual({
      showId: 1396,
      number: 1,
      name: 'Temporada 1',
      overview: 'Walter White learns he is ill.',
      overviewLanguage: 'en',
      airDate: '2008-01-20',
      posterPath: '/s1.jpg',
      episodes: [
        {
          number: 1,
          name: 'Episode 1',
          overview: 'Walter recebe um diagnóstico.',
          airDate: '2008-01-20',
          runtime: 47,
          stillPath: '/e1.jpg',
          voteAverage: 8.1,
        },
        {
          number: 2,
          overview: 'Walt and Jesse clean up.',
          overviewLanguage: 'en',
          airDate: '2008-01-20',
          runtime: 47,
          stillPath: '/e2.jpg',
          voteAverage: 8.1,
          finale: true,
        },
      ],
    });
    expect(requestedUrl(0).pathname).toBe('/3/tv/1396/season/1');
    expect(requestedUrl(0).searchParams.get('language')).toBe('pt-BR');
    expect(requestedUrl(1).searchParams.get('language')).toBe('en-US');
  });

  it('asks once in English', async () => {
    const { client, fetch } = setup([
      answer(200, season('', [episode(1, '')])),
    ]);

    const { episodes } = await client.season({
      id: 1396,
      season: 1,
      language: 'en',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(episodes[0].overview).toBeUndefined();
  });

  it('shows the season without the English synopses when they fail', async () => {
    const { client } = setup([
      answer(200, season('Uma temporada.', [episode(1, '')])),
      answer(500, {}),
    ]);

    await expect(
      client.season({ id: 1396, season: 1, language: 'es' }),
    ).resolves.toMatchObject({
      overview: 'Uma temporada.',
      episodes: [{ number: 1 }],
    });
  });

  it('reports a season TMDB does not have', async () => {
    const { client } = setup([
      answer(404, { status_code: 34 }),
      answer(404, { status_code: 34 }),
    ]);

    await expect(
      client.season({ id: 1396, season: 9, language: 'pt-BR' }),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('reports an answer without a season number as unreadable', async () => {
    const { client } = setup([answer(200, { episodes: [] })]);

    await expect(
      client.season({ id: 1396, season: 1, language: 'en' }),
    ).rejects.toMatchObject({ code: 'server' });
  });
});

describe('person', () => {
  const keanu = {
    id: 6384,
    adult: false,
    name: 'Keanu Reeves',
    known_for_department: 'Acting',
    biography: 'Keanu Charles Reeves é um ator canadense.',
    birthday: '1964-09-02',
    deathday: null,
    place_of_birth: 'Beirut, Lebanon',
    profile_path: '/keanu.jpg',
    homepage: null,
    imdb_id: 'nm0000206',
    popularity: 50,
    external_ids: {
      imdb_id: 'nm0000206',
      instagram_id: null,
      twitter_id: 'keanu_x',
      facebook_id: 'Keanu.Page',
      tiktok_id: 'not a handle!',
    },
    translations: { translations: [] },
    combined_credits: {
      cast: [
        {
          id: 2001,
          media_type: 'tv',
          name: 'A Talk Show',
          genre_ids: [10767, 35],
          vote_count: 9000,
          character: 'Self',
        },
        {
          id: 245891,
          media_type: 'movie',
          title: 'John Wick',
          release_date: '2014-10-22',
          overview: 'Um assassino aposentado.',
          vote_count: 18000,
          popularity: 99,
          character: 'John Wick',
        },
        {
          id: 603,
          media_type: 'movie',
          title: 'Matrix',
          release_date: '1999-03-31',
          poster_path: '/matrix.jpg',
          genre_ids: [28, 878],
          vote_average: 8.2,
          vote_count: 26000,
          character: 'Neo',
        },
        {
          id: 603,
          media_type: 'movie',
          title: 'Matrix',
          vote_count: 26000,
          character: 'Thomas Anderson ',
        },
        {
          id: 1100,
          media_type: 'tv',
          name: 'Swedish Dicks',
          vote_count: 40,
          character: '',
        },
        { id: 9999, media_type: 'movie', title: 'Adult', adult: true },
        { id: 7, media_type: 'person', name: 'Not a title' },
      ],
      crew: [
        {
          id: 186759,
          media_type: 'movie',
          title: 'Man of Tai Chi',
          department: 'Production',
          job: 'Producer',
        },
        {
          id: 186759,
          media_type: 'movie',
          title: 'Man of Tai Chi',
          department: 'Directing',
          job: 'Director',
        },
        {
          id: 186759,
          media_type: 'movie',
          title: 'Man of Tai Chi',
          department: 'Directing',
          job: 'Second Unit Director',
        },
      ],
    },
  };

  const inPortuguese = { id: 6384, language: 'pt-BR' };

  it('asks for the person with their credits, links and biographies in one request', async () => {
    const { client, requestedUrl } = setup([answer(200, keanu)]);

    await client.person(inPortuguese);

    const url = requestedUrl();
    expect(url.pathname).toBe('/3/person/6384');
    expect(url.searchParams.get('language')).toBe('pt-BR');
    expect(url.searchParams.get('append_to_response')).toBe(
      'combined_credits,external_ids,translations',
    );
  });

  it('keeps what the page shows, each title once, the best known first', async () => {
    const { client } = setup([answer(200, keanu)]);

    await expect(client.person(inPortuguese)).resolves.toEqual({
      id: 6384,
      name: 'Keanu Reeves',
      department: 'Acting',
      biography: 'Keanu Charles Reeves é um ator canadense.',
      birthday: '1964-09-02',
      placeOfBirth: 'Beirut, Lebanon',
      profilePath: '/keanu.jpg',
      // a handle that is not one is left out
      links: { imdb: 'nm0000206', x: 'keanu_x', facebook: 'Keanu.Page' },
      cast: [
        {
          id: 603,
          media_type: 'movie',
          title: 'Matrix',
          release_date: '1999-03-31',
          poster_path: '/matrix.jpg',
          genre_ids: [28, 878],
          vote_average: 8.2,
          // two roles in the same title
          character: 'Neo / Thomas Anderson',
        },
        {
          id: 245891,
          media_type: 'movie',
          title: 'John Wick',
          release_date: '2014-10-22',
          overview: 'Um assassino aposentado.',
          character: 'John Wick',
        },
        { id: 1100, media_type: 'tv', name: 'Swedish Dicks' },
        // more votes, but a talk show: last
        {
          id: 2001,
          media_type: 'tv',
          name: 'A Talk Show',
          genre_ids: [10767, 35],
          character: 'Self',
        },
      ],
      crew: [
        {
          id: 186759,
          media_type: 'movie',
          title: 'Man of Tai Chi',
          departments: ['Directing', 'Production'],
        },
      ],
    });
  });

  it.each([
    [
      'from another country, in the same language',
      [
        { iso_639_1: 'en', iso_3166_1: 'US', data: { biography: 'An actor.' } },
        { iso_639_1: 'pt', iso_3166_1: 'PT', data: { biography: 'Um actor.' } },
      ],
      { biography: 'Um actor.' },
    ],
    [
      'in English, saying so, when none is in the language',
      [
        {
          iso_639_1: 'fr',
          iso_3166_1: 'FR',
          data: { biography: 'Un acteur.' },
        },
        { iso_639_1: 'en', iso_3166_1: 'US', data: { biography: 'An actor.' } },
      ],
      { biography: 'An actor.', biographyLanguage: 'en' },
    ],
    [
      'nowhere, when neither has one',
      [
        {
          iso_639_1: 'fr',
          iso_3166_1: 'FR',
          data: { biography: 'Un acteur.' },
        },
        { iso_639_1: 'en', iso_3166_1: 'US', data: { biography: ' ' } },
        { iso_639_1: 'en', iso_3166_1: 'GB', data: null },
      ],
      {},
    ],
  ])(
    'finds a biography %s',
    async (
      _case,
      translations,
      expected: { biography?: string; biographyLanguage?: string },
    ) => {
      const { client } = setup([
        answer(200, {
          ...keanu,
          biography: '',
          translations: { translations },
        }),
      ]);

      const person = await client.person(inPortuguese);

      expect(person.biography).toBe(expected.biography);
      expect(person.biographyLanguage).toBe(expected.biographyLanguage);
    },
  );

  it('keeps only a site that opens safely, and an IMDb id of a person', async () => {
    const { client } = setup([
      answer(200, { ...keanu, homepage: 'https://keanu.example/' }),
      answer(200, {
        ...keanu,
        homepage: 'http://keanu.example/',
        imdb_id: 'tt0133093',
        external_ids: { imdb_id: 'javascript:alert(1)' },
      }),
    ]);

    await expect(client.person(inPortuguese)).resolves.toMatchObject({
      links: { homepage: 'https://keanu.example/' },
    });
    await expect(client.person(inPortuguese)).resolves.toMatchObject({
      links: {
        homepage: undefined,
        imdb: undefined,
        x: undefined,
      },
    });
  });

  it('does not show an adult, whom no search would list', async () => {
    const { client } = setup([answer(200, { ...keanu, adult: true })]);

    await expect(client.person(inPortuguese)).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('reports an answer without a name as unreadable', async () => {
    const { client } = setup([answer(200, { ...keanu, name: ' ' })]);

    await expect(client.person(inPortuguese)).rejects.toMatchObject({
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
        description: 'MoviLedger',
        language: 'pt-BR',
      }),
    ).resolves.toBe(88);

    expect(fetch).toHaveBeenCalledOnce();
    expect(asked(fetch)).toMatchObject({
      method: 'POST',
      body: {
        name: 'Assistidos',
        description: 'MoviLedger',
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
      description: 'MoviLedger',
    });

    expect(asked(fetch)).toMatchObject({
      method: 'PUT',
      body: {
        name: 'Assistidos',
        description: 'MoviLedger',
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

  it('writes the comment of a title in a list on its own', async () => {
    const { client, fetch } = setup([
      answer(200, {
        success: true,
        results: [{ media_type: 'tv', media_id: 1396, success: true }],
      }),
    ]);

    await client.commentOn(
      USER,
      77,
      { type: 'tv', id: 1396 },
      '2026-11-20;1:1',
    );

    expect(asked(fetch)).toMatchObject({
      method: 'PUT',
      body: {
        items: [
          { media_type: 'tv', media_id: 1396, comment: '2026-11-20;1:1' },
        ],
      },
      authorization: `Bearer ${USER}`,
    });
  });

  it.each([
    ['for the title', { results: [{ media_id: 1396, success: false }] }],
    ['for all of it', { success: false }],
  ])(
    'fails when TMDB says it did not take the comment %s',
    async (_case, body) => {
      const { client } = setup([answer(200, body)]);

      await expect(
        client.commentOn(USER, 77, { type: 'tv', id: 1396 }, '2026-11-20;1:1'),
      ).rejects.toMatchObject({ code: 'server' });
    },
  );

  it('puts a title in a list without a comment', async () => {
    const { client, fetch } = setup([answer(200, { success: true })]);

    await client.addItem(USER, 77, { type: 'tv', id: 1396 });

    expect(fetch).toHaveBeenCalledOnce();
    expect(asked(fetch)).toMatchObject({
      method: 'POST',
      body: { items: [{ media_type: 'tv', media_id: 1396 }] },
    });
  });

  it('reads the comments of a page of a list, whatever they say', async () => {
    const { client, fetch } = setup([
      answer(200, {
        page: 2,
        results: [
          { id: 1396, media_type: 'tv', name: 'Breaking Bad' },
          { id: 603, media_type: 'movie', title: 'The Matrix' },
          { id: 31, media_type: 'person', name: 'Tom Hanks' },
          { media_type: 'tv' },
        ],
        comments: { 'tv:1396': '2026-11-20;1:1-3', 'movie:603': null },
        total_pages: 3,
      }),
    ]);

    await expect(client.listComments(USER, 77, 2)).resolves.toEqual({
      items: [
        { type: 'tv', id: 1396, comment: '2026-11-20;1:1-3' },
        { type: 'movie', id: 603 },
      ],
      totalPages: 3,
    });
    expect(Object.fromEntries(asked(fetch).url.searchParams)).toEqual({
      page: '2',
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
