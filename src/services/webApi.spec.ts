import { describe, expect, it, vi } from 'vitest';
import type { SearchRequest, SessionState } from '@shared/api';
import type { FetchLike } from '@shared/tmdb/client';
import { createTmdbProxy } from '@shared/tmdb/proxy';
import { createWebApi, type WebFetch } from '@/services/webApi';

const search: SearchRequest = {
  type: 'tv',
  query: 'tom & jerry',
  page: 3,
  language: 'pt-BR',
};

const SIGNED_IN: SessionState = {
  status: 'authenticated',
  account: { id: 7, username: 'ada', name: 'Ada Lovelace' },
};

function answering(body: unknown, status = 200) {
  return vi.fn<WebFetch>(
    async () => new Response(JSON.stringify(body), { status }),
  );
}

/** A browser that goes nowhere, and brings the page back when told to. */
function aBrowser() {
  const waiting: (() => void)[] = [];

  return {
    navigate: vi.fn<(url: string) => void>(),
    onRestored: (listener: () => void) => {
      waiting.push(listener);
    },
    restore: () => waiting.splice(0).forEach((listener) => listener()),
  };
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

  describe('signing in', () => {
    it('asks the site who is signed in', async () => {
      const fetch = answering(SIGNED_IN);

      await expect(createWebApi(fetch).auth.getSession()).resolves.toEqual(
        SIGNED_IN,
      );

      const [url, init] = fetch.mock.calls[0];

      expect(url).toBe('/api/auth/session');
      expect(init.method).toBeUndefined();
      expect(init.headers).toEqual({ Accept: 'application/json' });
    });

    it.each<SessionState>([
      { status: 'anonymous' },
      { status: 'error', reason: 'denied' },
    ])('hands back what the site says: $status', async (state) => {
      await expect(
        createWebApi(answering(state)).auth.getSession(),
      ).resolves.toEqual(state);
    });

    it('takes the answer of a site that could not ask TMDB', async () => {
      const state = { status: 'error', reason: 'network' };

      await expect(
        createWebApi(answering(state, 502)).auth.getSession(),
      ).resolves.toEqual(state);
    });

    it.each([
      ['could not be reached', new TypeError('Failed to fetch')],
      [
        'took too long',
        new DOMException('The operation timed out.', 'TimeoutError'),
      ],
    ])('reports a site that %s', async (_case, error) => {
      const fetch = vi.fn<WebFetch>(async () => {
        throw error;
      });

      await expect(createWebApi(fetch).auth.getSession()).resolves.toEqual({
        status: 'error',
        reason: 'network',
      });
    });

    it.each([
      ['a page of the host', '<html>404</html>'],
      ['JSON in another shape', JSON.stringify({ ok: true, data: [] })],
      [
        'a login that is waiting',
        JSON.stringify({ status: 'pending', expiresAt: 1, authorizeUrl: '' }),
      ],
      [
        'someone signed in without an account',
        JSON.stringify({ status: 'authenticated', account: { id: '7' } }),
      ],
      [
        'a failure it does not know',
        JSON.stringify({ status: 'error', reason: 'hacked' }),
      ],
    ])('does not trust %s in place of the session', async (_case, text) => {
      const fetch = vi.fn<WebFetch>(async () => new Response(text));

      await expect(createWebApi(fetch).auth.getSession()).resolves.toEqual({
        status: 'error',
        reason: 'unavailable',
      });
    });

    it('leaves the app for the site to sign in, and waits', async () => {
      const fetch = answering(SIGNED_IN);
      const browser = aBrowser();
      const { auth } = createWebApi(fetch, browser);
      let answered = false;

      const login = auth.login('en').then((state) => {
        answered = true;

        return state;
      });
      await new Promise((resolve) => setTimeout(resolve));

      expect(browser.navigate).toHaveBeenCalledExactlyOnceWith(
        '/api/auth/login',
      );
      expect(answered).toBe(false);
      expect(fetch).not.toHaveBeenCalled();

      // the back button, in a browser that kept the page as it was
      browser.restore();

      await expect(login).resolves.toEqual(SIGNED_IN);
      expect(fetch.mock.calls[0][0]).toBe('/api/auth/session');
    });

    it('signs out with a POST to the site', async () => {
      const fetch = answering({ status: 'anonymous' });

      await expect(createWebApi(fetch).auth.logout()).resolves.toEqual({
        status: 'anonymous',
      });

      const [url, init] = fetch.mock.calls[0];

      expect(url).toBe('/api/auth/logout');
      expect(init.method).toBe('POST');
    });

    it.each([
      ['does not answer', () => Promise.reject(new TypeError('Failed'))],
      ['refuses', async () => new Response(null, { status: 403 })],
    ])('is still signed in when the site %s', async (_case, answer) => {
      const fetch = answering(SIGNED_IN);
      const { auth } = createWebApi(fetch);

      await auth.getSession();
      fetch.mockImplementationOnce(answer);

      await expect(auth.logout()).resolves.toEqual(SIGNED_IN);
    });

    it('has no waiting to confirm or to give up', async () => {
      const fetch = answering(SIGNED_IN);
      const { auth } = createWebApi(fetch);
      const stop = auth.onChange(() => {
        throw new Error('nothing changes by itself');
      });

      expect(await auth.cancelLogin()).toEqual({ status: 'anonymous' });
      expect(fetch).not.toHaveBeenCalled();

      expect(await auth.confirmManual()).toEqual(SIGNED_IN);
      expect(fetch.mock.calls[0][0]).toBe('/api/auth/session');
      // giving up signs nobody out
      expect(await auth.cancelLogin()).toEqual(SIGNED_IN);
      expect(stop).not.toThrow();
    });

    it('has nothing to remember: the site keeps the session', async () => {
      const fetch = answering(SIGNED_IN);

      await expect(createWebApi(fetch).auth.remember()).resolves.toEqual(
        SIGNED_IN,
      );
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toBe('/api/auth/session');
    });
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

  it('asks the site for a list of the home page', async () => {
    const titles = [{ id: 603, media_type: 'movie', title: 'Matrix' }];
    const fetch = answering({ ok: true, data: titles });

    await expect(
      createWebApi(fetch).tmdb.list({ list: 'trending', language: 'es' }),
    ).resolves.toEqual({ ok: true, data: titles });
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/tmdb?resource=list&list=trending&language=es',
    );
  });

  it('asks the site for the page of a title', async () => {
    const details = { type: 'tv', id: 1396, title: 'Breaking Bad' };
    const fetch = answering({ ok: true, data: details });

    await expect(
      createWebApi(fetch).tmdb.details({
        type: 'tv',
        id: 1396,
        language: 'pt-BR',
        region: 'BR',
      }),
    ).resolves.toEqual({ ok: true, data: details });
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/tmdb?resource=details&type=tv&id=1396&language=pt-BR&region=BR',
    );
  });

  describe('lists of the account', () => {
    it('asks the site where a title is', async () => {
      const states = { watchlist: true, favorite: false };
      const fetch = answering({ ok: true, data: states });

      await expect(
        createWebApi(fetch).account.states({ type: 'movie', id: 603 }),
      ).resolves.toEqual({ ok: true, data: states });
      expect(fetch.mock.calls[0][0]).toBe(
        '/api/account?resource=states&type=movie&id=603',
      );
      expect(fetch.mock.calls[0][1].method).toBeUndefined();
    });

    it('changes a list with a POST', async () => {
      const fetch = answering({ ok: true, data: null });

      await expect(
        createWebApi(fetch).account.mark({
          list: 'favorite',
          type: 'tv',
          id: 1396,
          value: false,
        }),
      ).resolves.toEqual({ ok: true, data: null });
      expect(fetch.mock.calls[0][0]).toBe(
        '/api/account?resource=mark&list=favorite&type=tv&id=1396&value=false',
      );
      expect(fetch.mock.calls[0][1].method).toBe('POST');
    });

    it('asks the site for a page of a list', async () => {
      const fetch = answering({
        ok: true,
        data: { page: 2, results: [], totalPages: 2, totalResults: 21 },
      });

      await createWebApi(fetch).account.list({
        list: 'watchlist',
        type: 'movie',
        page: 2,
        language: 'es',
      });

      expect(fetch.mock.calls[0][0]).toBe(
        '/api/account?resource=list&list=watchlist&type=movie&page=2&language=es',
      );
    });

    it('hands back that nobody is signed in', async () => {
      const failure = { ok: false, error: { code: 'signed-out' } };

      await expect(
        createWebApi(answering(failure, 401)).account.states({
          type: 'movie',
          id: 603,
        }),
      ).resolves.toEqual(failure);
    });
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
          results: [
            { id: 1, media_type: 'tv', name: 'Tom & Jerry', genre_ids: [16] },
          ],
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
