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
          results: [{ id: 603, title: 'The Matrix' }],
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
