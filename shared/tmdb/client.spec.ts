// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { TMDB_PAGE_SIZE } from '../api';
import {
  createTmdbClient,
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
      results: [{ id: 603, title: 'The Matrix' }],
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

describe('signing in', () => {
  const REQUEST_TOKEN = 'a1b2c3d4e5f6';
  const SESSION = 'the-session-id-works-as-a-password';

  it('asks for a request token', async () => {
    const { client, fetch, requestedUrl } = setup([
      answer(200, {
        success: true,
        expires_at: '2026-11-14 18:00:00 UTC',
        request_token: REQUEST_TOKEN,
      }),
    ]);

    await expect(client.createRequestToken()).resolves.toBe(REQUEST_TOKEN);

    expect(requestedUrl().pathname).toBe('/3/authentication/token/new');
    expect(fetch.mock.calls[0][1].method).toBeUndefined();
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
  });

  it('trades an approved request token for a session', async () => {
    const { client, fetch, requestedUrl } = setup(
      [answer(200, { success: true, session_id: SESSION })],
      { credential: V4_TOKEN },
    );

    await expect(client.createSession(REQUEST_TOKEN)).resolves.toBe(SESSION);

    const init = fetch.mock.calls[0][1];
    expect(requestedUrl().pathname).toBe('/3/authentication/session/new');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body!)).toEqual({ request_token: REQUEST_TOKEN });
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${V4_TOKEN}`,
      'Content-Type': 'application/json',
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

    await expect(client.deleteSession(SESSION)).resolves.toBeUndefined();

    const init = fetch.mock.calls[0][1];
    expect(requestedUrl().pathname).toBe('/3/authentication/session');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body!)).toEqual({ session_id: SESSION });
    // not in the address, which is what ends up in logs
    expect(requestedUrl().search).not.toContain(SESSION);
  });

  it.each([
    ['a request token', () => ({ success: true })],
    ['a session', () => ({ success: true, session_id: '' })],
    ['an account', () => ({ username: 'ada' })],
  ] as const)('does not accept an answer without %s', async (what, body) => {
    const { client } = setup([answer(200, body())]);
    const ask = {
      'a request token': () => client.createRequestToken(),
      'a session': () => client.createSession(REQUEST_TOKEN),
      'an account': () => client.account(SESSION),
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
