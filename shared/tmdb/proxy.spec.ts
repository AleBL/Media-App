// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Result } from '../api';
import type { FetchLike } from './client';
import { createTmdbProxy } from './proxy';

const TOKEN = 'site.read-access.token';
const SITE = 'https://media-app.test/api/tmdb';

function tmdbAnswers(status: number, body: unknown) {
  return vi.fn<FetchLike>(
    async () => new Response(JSON.stringify(body), { status }),
  );
}

const searchBody = {
  page: 2,
  results: [{ id: 603, title: 'The Matrix', adult: false, popularity: 9 }],
  total_pages: 3,
  total_results: 45,
};

async function ask(
  query: string,
  fetch = tmdbAnswers(200, searchBody),
  options: { credential?: string; method?: string } = {},
) {
  const proxy = createTmdbProxy({
    credential: 'credential' in options ? options.credential : TOKEN,
    fetch,
  });
  const response = await proxy(
    new Request(`${SITE}${query}`, { method: options.method ?? 'GET' }),
  );

  return {
    response,
    body: (await response.json()) as Result<unknown>,
    fetch,
  };
}

const SEARCH = '?resource=search&type=movie&query=matrix&page=2&language=pt-BR';

describe('tmdb proxy', () => {
  describe('search', () => {
    it('asks TMDB with the credential of the server and answers like the desktop app', async () => {
      const { response, body, fetch } = await ask(SEARCH);

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        data: {
          page: 2,
          // only the fields the app uses
          results: [{ id: 603, media_type: 'movie', title: 'The Matrix' }],
          totalPages: 3,
          totalResults: 45,
        },
      });

      const [url, init] = fetch.mock.calls[0];
      const asked = new URL(url);

      expect(asked.origin + asked.pathname).toBe(
        'https://api.themoviedb.org/3/search/movie',
      );
      expect(Object.fromEntries(asked.searchParams)).toEqual({
        query: 'matrix',
        page: '2',
        language: 'pt-BR',
        include_adult: 'false',
      });
      expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    });

    it('searches everything, and answers with the people it found', async () => {
      const { body, fetch } = await ask(
        SEARCH.replace('type=movie', 'type=multi'),
        tmdbAnswers(200, {
          ...searchBody,
          results: [
            { id: 603, media_type: 'movie', title: 'The Matrix' },
            {
              id: 6384,
              media_type: 'person',
              name: 'Keanu Reeves',
              known_for: [
                { id: 603, media_type: 'movie', title: 'The Matrix' },
              ],
            },
          ],
        }),
      );

      expect(new URL(fetch.mock.calls[0][0]).pathname).toBe('/3/search/multi');
      expect(body).toMatchObject({
        ok: true,
        data: {
          results: [
            { id: 603, media_type: 'movie' },
            { id: 6384, media_type: 'person', name: 'Keanu Reeves' },
          ],
        },
      });
    });

    it('never puts the credential in what it answers', async () => {
      const { response, body } = await ask(SEARCH);

      expect(JSON.stringify(body)).not.toContain(TOKEN);
      response.headers.forEach((value) => expect(value).not.toContain(TOKEN));
    });

    it('lets the CDN keep the answer, and makes the browser ask every time', async () => {
      const { response } = await ask(SEARCH);

      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
      );
      expect(response.headers.get('Content-Type')).toContain(
        'application/json',
      );
    });

    it.each([
      ['no type', '?resource=search&query=matrix&page=1&language=en'],
      ['a type the app does not search', SEARCH.replace('movie', 'person')],
      ['no query', '?resource=search&type=movie&page=1&language=en'],
      ['a blank query', SEARCH.replace('matrix', '%20%20')],
      ['no page', '?resource=search&type=movie&query=matrix&language=en'],
      ['a page that is not a number', SEARCH.replace('page=2', 'page=two')],
      [
        'a page past the last one of TMDB',
        SEARCH.replace('page=2', 'page=501'),
      ],
      ['a language that is not a locale', SEARCH.replace('pt-BR', '../etc')],
    ])('refuses %s without asking TMDB', async (_case, query) => {
      const { response, body, fetch } = await ask(query);

      expect(response.status).toBe(400);
      expect(body).toEqual({ ok: false, error: { code: 'invalid-request' } });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('genres', () => {
    it('answers with movie and tv genres in one list', async () => {
      const fetch = vi.fn<FetchLike>(
        async (url) =>
          new Response(
            JSON.stringify({
              genres: url.includes('/genre/movie/')
                ? [{ id: 28, name: 'Ação' }]
                : [{ id: 18, name: 'Drama' }],
            }),
          ),
      );

      const { response, body } = await ask(
        '?resource=genres&language=pt-BR',
        fetch,
      );

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        data: [
          { id: 28, name: 'Ação' },
          { id: 18, name: 'Drama' },
        ],
      });
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      );
    });

    it('refuses a language that is not a locale', async () => {
      const { response, fetch } = await ask('?resource=genres&language=x');

      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('regions', () => {
    it('answers the countries where TMDB knows where to watch, kept a day', async () => {
      const fetch = vi.fn<FetchLike>(
        async () =>
          new Response(
            JSON.stringify({
              results: [
                { iso_3166_1: 'US', english_name: 'United States' },
                { iso_3166_1: 'BR', english_name: 'Brazil' },
              ],
            }),
          ),
      );

      const { response, body } = await ask('?resource=regions', fetch);

      expect(body).toEqual({ ok: true, data: ['BR', 'US'] });
      expect(new URL(fetch.mock.calls[0][0]).pathname).toBe(
        '/3/watch/providers/regions',
      );
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      );
    });
  });

  describe('lists of the home page', () => {
    it('answers with the titles, kept by the CDN for an hour', async () => {
      const fetch = tmdbAnswers(200, {
        results: [{ id: 603, title: 'Matrix', popularity: 9 }],
      });

      const { response, body } = await ask(
        '?resource=list&list=popular-movies&language=es',
        fetch,
      );

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        data: [{ id: 603, media_type: 'movie', title: 'Matrix' }],
      });
      expect(new URL(fetch.mock.calls[0][0]).pathname).toBe('/3/movie/popular');
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      );
    });

    it.each([
      ['no list', '?resource=list&language=en'],
      [
        'a list the app does not show',
        '?resource=list&list=upcoming&language=en',
      ],
      ['no language', '?resource=list&list=trending'],
    ])('refuses %s without asking TMDB', async (_case, query) => {
      const { response, fetch } = await ask(query, tmdbAnswers(200, {}));

      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('details', () => {
    const DETAILS =
      '?resource=details&type=movie&id=603&language=pt-BR&region=BR';
    const matrix = {
      id: 603,
      title: 'Matrix',
      budget: 63000000,
      'watch/providers': {
        results: {
          BR: { flatrate: [{ provider_id: 8, provider_name: 'Netflix' }] },
          US: { flatrate: [{ provider_id: 9, provider_name: 'Prime Video' }] },
        },
      },
    };

    it('answers with the page of the title, where to watch in the region', async () => {
      const fetch = tmdbAnswers(200, matrix);

      const { response, body } = await ask(DETAILS, fetch);

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        data: {
          type: 'movie',
          id: 603,
          title: 'Matrix',
          genres: [],
          cast: [],
          watch: {
            stream: [{ id: 8, name: 'Netflix' }],
            free: [],
            rent: [],
            buy: [],
          },
        },
      });
      expect(new URL(fetch.mock.calls[0][0]).pathname).toBe('/3/movie/603');
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      );
    });

    it('answers 404 for a title TMDB does not have, and keeps nothing', async () => {
      const { response, body } = await ask(
        DETAILS,
        tmdbAnswers(404, { status_code: 34, status_message: 'Not found.' }),
      );

      expect(response.status).toBe(404);
      expect(body).toMatchObject({ ok: false, error: { code: 'not-found' } });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it.each([
      ['a type the app does not show', DETAILS.replace('movie', 'person')],
      ['no id', DETAILS.replace('id=603&', '')],
      ['an id that is a path', DETAILS.replace('603', '603%2Fvideos')],
      ['no region', DETAILS.replace('&region=BR', '')],
      ['a region that is not a country', DETAILS.replace('BR', 'Brazil')],
    ])('refuses %s without asking TMDB', async (_case, query) => {
      const { response, body, fetch } = await ask(query, tmdbAnswers(200, {}));

      expect(response.status).toBe(400);
      expect(body).toEqual({ ok: false, error: { code: 'invalid-request' } });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('person', () => {
    const PERSON = '?resource=person&id=6384&language=pt-BR';

    it('answers with the page of the person, kept as long as a title', async () => {
      const fetch = tmdbAnswers(200, {
        id: 6384,
        name: 'Keanu Reeves',
        popularity: 50,
        combined_credits: {
          cast: [
            { id: 603, media_type: 'movie', title: 'Matrix', character: 'Neo' },
          ],
        },
      });

      const { response, body } = await ask(PERSON, fetch);

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        data: {
          id: 6384,
          name: 'Keanu Reeves',
          links: {},
          cast: [
            { id: 603, media_type: 'movie', title: 'Matrix', character: 'Neo' },
          ],
          crew: [],
        },
      });
      const url = new URL(fetch.mock.calls[0][0]);
      expect(url.pathname).toBe('/3/person/6384');
      expect(url.searchParams.get('language')).toBe('pt-BR');
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      );
    });

    it.each([
      ['no id', '?resource=person&language=pt-BR'],
      ['an id that is a path', PERSON.replace('6384', '6384%2Fimages')],
      ['no language', '?resource=person&id=6384'],
    ])('refuses %s without asking TMDB', async (_case, query) => {
      const { response, fetch } = await ask(query, tmdbAnswers(200, {}));

      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('discovery', () => {
    const DISCOVER =
      '?resource=discover&type=tv&page=2&language=pt-BR&region=BR&sort=rating';

    it('asks TMDB with every filter, kept as long as a search', async () => {
      const fetch = tmdbAnswers(200, searchBody);

      const { response, body } = await ask(
        `${DISCOVER}&genres=18,80&from=1990&to=1999&rating=7&original=ko&providers=8,119`,
        fetch,
      );

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        ok: true,
        data: { results: [{ id: 603, media_type: 'tv' }], totalResults: 45 },
      });
      const url = new URL(fetch.mock.calls[0][0]);
      expect(url.pathname).toBe('/3/discover/tv');
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        page: '2',
        sort_by: 'vote_average.desc',
        with_genres: '18,80',
        'first_air_date.gte': '1990-01-01',
        'first_air_date.lte': '1999-12-31',
        'vote_average.gte': '7',
        with_original_language: 'ko',
        watch_region: 'BR',
        with_watch_providers: '8|119',
      });
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
      );
    });

    it('answers with what the filters offer, kept as long as the genres', async () => {
      const fetch = vi.fn<FetchLike>(async (url) => {
        const path = new URL(url).pathname;
        const body = path.startsWith('/3/genre/')
          ? { genres: [{ id: 18, name: 'Drama' }] }
          : path.startsWith('/3/watch/')
            ? { results: [] }
            : path.startsWith('/3/certification/')
              ? { certifications: { BR: [{ certification: 'L', order: 0 }] } }
              : [{ iso_639_1: 'ko' }];

        return new Response(JSON.stringify(body));
      });

      const { response, body } = await ask(
        '?resource=discover-filters&type=tv&language=pt-BR&region=BR',
        fetch,
      );

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        data: {
          genres: [{ id: 18, name: 'Drama' }],
          providers: [],
          ageRatings: ['L'],
          languages: ['ko'],
        },
      });
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      );
    });

    it.each([
      ['no order', DISCOVER.replace('&sort=rating', '')],
      ['an empty list of genres', `${DISCOVER}&genres=`],
      ['a genre that is not an id', `${DISCOVER}&genres=18,drama`],
      ['a year that is not one', `${DISCOVER}&from=nineties`],
      ['an age rating that joins two', `${DISCOVER}&age=L%7C10`],
      [
        'the filters of no type',
        '?resource=discover-filters&language=en&region=BR',
      ],
    ])('refuses %s without asking TMDB', async (_case, query) => {
      const { response, fetch } = await ask(query, tmdbAnswers(200, {}));

      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it.each([
    ['nothing', ''],
    ['an unknown resource', '?resource=account'],
    ['a path of TMDB', '?resource=/3/account&path=/3/account'],
  ])('is not a general proxy: refuses %s', async (_case, query) => {
    const { response, body, fetch } = await ask(query);

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: { code: 'invalid-request' } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'DELETE'])('refuses %s', async (method) => {
    const { response, fetch } = await ask(SEARCH, undefined, { method });

    expect(response.status).toBe(400);
    expect(response.headers.get('Allow')).toBe('GET');
    expect(fetch).not.toHaveBeenCalled();
  });

  describe('when it cannot get an answer from TMDB', () => {
    it.each([undefined, '', '   '])(
      'says that the site has no credential (%j)',
      async (credential) => {
        const { response, body, fetch } = await ask(SEARCH, undefined, {
          credential,
        });

        expect(response.status).toBe(503);
        expect(body).toEqual({
          ok: false,
          error: { code: 'missing-credential' },
        });
        expect(fetch).not.toHaveBeenCalled();
      },
    );

    it('reports a credential that TMDB refuses as a problem of the site', async () => {
      const { response, body } = await ask(
        SEARCH,
        tmdbAnswers(401, { status_message: 'Invalid API key.' }),
      );

      // not 401: the visitor has nothing to log in to
      expect(response.status).toBe(502);
      expect(body).toEqual({
        ok: false,
        error: {
          code: 'unauthorized',
          status: 401,
          message: 'Invalid API key.',
        },
      });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('passes on "too many requests" at once, without waiting to retry', async () => {
      const fetch = tmdbAnswers(429, {});
      const { response, body } = await ask(SEARCH, fetch);

      expect(response.status).toBe(429);
      expect(body).toMatchObject({ error: { code: 'rate-limited' } });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('reports a network failure', async () => {
      const fetch = vi.fn<FetchLike>(async () => {
        throw new TypeError('fetch failed');
      });
      const { response, body } = await ask(SEARCH, fetch);

      expect(response.status).toBe(502);
      expect(body).toEqual({ ok: false, error: { code: 'network' } });
    });

    it('tells nothing about an unexpected error', async () => {
      const fetch = vi.fn<FetchLike>(
        async () =>
          ({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({ results: 'not a list' }),
          }) as unknown as Response,
      );
      const { response, body } = await ask(SEARCH, fetch);

      expect(response.status).toBe(502);
      expect(body).toEqual({ ok: false, error: { code: 'server' } });
    });
  });
});
