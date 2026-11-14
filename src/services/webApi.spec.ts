import { describe, expect, it, vi } from 'vitest';
import type { SearchRequest } from '@shared/api';
import type { FetchLike } from '@shared/tmdb/client';
import { createTmdbProxy } from '@shared/tmdb/proxy';
import { createWebApi, type WebFetch } from '@/services/webApi';

const search: SearchRequest = {
  type: 'tv',
  query: 'tom & jerry',
  page: 3,
  language: 'pt-BR',
};

function answering(body: unknown, status = 200) {
  return vi.fn<WebFetch>(
    async () => new Response(JSON.stringify(body), { status }),
  );
}

describe('web api', () => {
  it('says it is the web version, with access to TMDB and no key of the user', async () => {
    const api = createWebApi(answering({}));

    expect(api.platform).toBe('web');
    expect(await api.credentials.status()).toEqual({
      hasKey: false,
      persisted: false,
      encrypted: false,
      builtIn: true,
    });
  });

  it('keeps no key: saving and clearing change nothing', async () => {
    const fetch = answering({});
    const api = createWebApi(fetch);

    expect((await api.credentials.save('0123456789abcdef')).hasKey).toBe(false);
    expect((await api.credentials.clear()).builtIn).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks the site for a search and hands back its answer', async () => {
    const page = { page: 3, results: [], totalPages: 3, totalResults: 45 };
    const fetch = answering({ ok: true, data: page });

    await expect(createWebApi(fetch).tmdb.search(search)).resolves.toEqual({
      ok: true,
      data: page,
    });

    const [url, init] = fetch.mock.calls[0];
    const asked = new URL(url, 'https://media-app.test');

    // relative: it goes to the site the page came from, whatever it is
    expect(url.startsWith('/api/tmdb?')).toBe(true);
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      resource: 'search',
      type: 'tv',
      query: 'tom & jerry',
      page: '3',
      language: 'pt-BR',
    });
    expect(init.headers).toEqual({ Accept: 'application/json' });
  });

  it('asks the site for the genres of a language', async () => {
    const fetch = answering({ ok: true, data: [{ id: 28, name: 'Action' }] });

    await expect(createWebApi(fetch).tmdb.genres('en')).resolves.toEqual({
      ok: true,
      data: [{ id: 28, name: 'Action' }],
    });
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/tmdb?resource=genres&language=en',
    );
  });

  it('hands back a failure of the site as it came', async () => {
    const failure = { ok: false, error: { code: 'rate-limited', status: 429 } };

    await expect(
      createWebApi(answering(failure, 429)).tmdb.search(search),
    ).resolves.toEqual(failure);
  });

  it('reports a request that could not be made', async () => {
    const fetch = vi.fn<WebFetch>(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(createWebApi(fetch).tmdb.search(search)).resolves.toEqual({
      ok: false,
      error: { code: 'network' },
    });
  });

  it('reports a request that took too long', async () => {
    const fetch = vi.fn<WebFetch>(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    });

    await expect(createWebApi(fetch).tmdb.search(search)).resolves.toEqual({
      ok: false,
      error: { code: 'timeout' },
    });
  });

  it.each([
    ['a page of the host', '<html>404</html>'],
    ['JSON in another shape', JSON.stringify({ results: [] })],
    ['a failure without a code', JSON.stringify({ ok: false, error: {} })],
  ])('does not trust %s in place of the answer', async (_case, text) => {
    const fetch = vi.fn<WebFetch>(
      async () => new Response(text, { status: 404 }),
    );

    await expect(createWebApi(fetch).tmdb.search(search)).resolves.toEqual({
      ok: false,
      error: { code: 'server', status: 404 },
    });
  });

  // The two halves of the web version, put together the way the site runs
  // them: the page asks the function, the function asks TMDB.
  describe('together with the function of the site', () => {
    function site(tmdb: FetchLike, credential: string | undefined = 'a.b.c') {
      const proxy = createTmdbProxy({ credential, fetch: tmdb });

      return createWebApi((url) =>
        proxy(new Request(new URL(url, 'https://media-app.test'))),
      );
    }

    it('searches', async () => {
      const tmdb = vi.fn<FetchLike>(
        async () =>
          new Response(
            JSON.stringify({
              page: 3,
              results: [{ id: 1, name: 'Tom & Jerry', genre_ids: [16] }],
              total_pages: 3,
              total_results: 41,
            }),
          ),
      );

      await expect(site(tmdb).tmdb.search(search)).resolves.toEqual({
        ok: true,
        data: {
          page: 3,
          results: [{ id: 1, name: 'Tom & Jerry', genre_ids: [16] }],
          totalPages: 3,
          totalResults: 41,
        },
      });
      expect(new URL(tmdb.mock.calls[0][0]).searchParams.get('query')).toBe(
        'tom & jerry',
      );
    });

    it('tells the page when the site has no credential', async () => {
      const tmdb = vi.fn<FetchLike>();

      await expect(site(tmdb, '').tmdb.genres('en')).resolves.toEqual({
        ok: false,
        error: { code: 'missing-credential' },
      });
      expect(tmdb).not.toHaveBeenCalled();
    });
  });
});
