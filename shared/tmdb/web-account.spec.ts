// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Result } from '../api';
import type { FetchLike } from './client';
import { createWebAccount } from './web-account';

const TOKEN = 'site.read-access.token';
const SITE = 'https://media-app.test';
const SESSION = 'b'.repeat(40);
const KEPT = '__Host-media-app-session';

type Answer = [status: number, body: unknown];

const ACCOUNT = 'GET /3/account';
const STATES = 'GET /3/movie/603/account_states';
const MARK = 'POST /3/account/7/watchlist';
const LIST = 'GET /3/account/7/favorite/tv';

const OVER: Answer = [401, { status_code: 3, status_message: 'Failed.' }];

/** A TMDB where everything works, except what `answers` says otherwise. */
function tmdbWith(answers: Record<string, Answer> = {}) {
  const all: Record<string, Answer> = {
    [ACCOUNT]: [200, { id: 7, username: 'ada' }],
    [STATES]: [
      200,
      { id: 603, watchlist: true, favorite: false, rated: false },
    ],
    [MARK]: [201, { status_code: 1 }],
    [LIST]: [
      200,
      {
        page: 1,
        results: [{ id: 1396, name: 'Breaking Bad' }],
        total_pages: 1,
        total_results: 1,
      },
    ],
    ...answers,
  };

  return vi.fn<FetchLike>(async (url, init) => {
    const [status, body] = all[
      `${init.method ?? 'GET'} ${new URL(url).pathname}`
    ] ?? [404, { status_code: 34 }];

    return new Response(JSON.stringify(body), { status });
  });
}

/** What TMDB was asked, as `METHOD /path` lines. */
const asked = (fetch: ReturnType<typeof tmdbWith>) =>
  fetch.mock.calls.map(
    ([url, init]) => `${init.method ?? 'GET'} ${new URL(url).pathname}`,
  );

interface Options {
  fetch?: ReturnType<typeof tmdbWith>;
  session?: string | null;
  method?: string;
  origin?: string;
}

async function visit(query: string, options: Options = {}) {
  const fetch = options.fetch ?? tmdbWith();
  const account = createWebAccount({ credential: TOKEN, fetch });
  const session = options.session === undefined ? SESSION : options.session;
  const headers: Record<string, string> = {};

  if (session) {
    headers.cookie = `${KEPT}=${session}`;
  }

  if (options.origin) {
    headers.origin = options.origin;
  }

  const response = await account(
    new Request(`${SITE}/api/account?${query}`, {
      method: options.method ?? 'GET',
      headers,
    }),
  );

  return {
    response,
    body: (await response.json().catch(() => null)) as Result<unknown> | null,
    fetch,
  };
}

const STATES_QUERY = 'resource=states&type=movie&id=603';
const MARK_QUERY = 'resource=mark&list=watchlist&type=movie&id=603&value=true';
const LIST_QUERY = 'resource=list&list=favorite&type=tv&page=1&language=pt-BR';

/** A change, the way the app itself sends it. */
const change = { method: 'POST', origin: SITE };

describe('web account', () => {
  it('says where a title is, with the session of the cookie', async () => {
    const { response, body, fetch } = await visit(STATES_QUERY);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: { watchlist: true, favorite: false },
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(asked(fetch)).toEqual([STATES]);

    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('session_id')).toBe(SESSION);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it('puts a title in a list of the account the session belongs to', async () => {
    const { response, body, fetch } = await visit(MARK_QUERY, change);

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: null });
    expect(asked(fetch)).toEqual([ACCOUNT, MARK]);
    expect(JSON.parse(fetch.mock.calls[1][1].body!)).toEqual({
      media_type: 'movie',
      media_id: 603,
      watchlist: true,
    });
  });

  it('reads a page of a list', async () => {
    const { body, fetch } = await visit(LIST_QUERY);

    expect(body).toEqual({
      ok: true,
      data: {
        page: 1,
        results: [{ id: 1396, media_type: 'tv', name: 'Breaking Bad' }],
        totalPages: 1,
        totalResults: 1,
      },
    });
    expect(asked(fetch)).toEqual([ACCOUNT, LIST]);
  });

  it('never puts the session in what it answers', async () => {
    for (const [query, options] of [
      [STATES_QUERY, {}],
      [MARK_QUERY, change],
      [LIST_QUERY, {}],
    ] as const) {
      const { response, body } = await visit(query, options);

      expect(JSON.stringify(body)).not.toContain(SESSION);
      response.headers.forEach((value) => expect(value).not.toContain(SESSION));
    }
  });

  it('answers signed-out to nobody signed in, without asking TMDB', async () => {
    const { response, body, fetch } = await visit(STATES_QUERY, {
      session: null,
    });

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: { code: 'signed-out' } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forgets a session that TMDB says is over', async () => {
    const { response, body } = await visit(STATES_QUERY, {
      fetch: tmdbWith({ [STATES]: OVER }),
    });

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: { code: 'signed-out' } });
    expect(response.headers.getSetCookie()).toEqual([
      `${KEPT}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`,
    ]);
  });

  it('keeps the session when TMDB fails in another way', async () => {
    const { response, body } = await visit(MARK_QUERY, {
      ...change,
      fetch: tmdbWith({ [MARK]: [500, { status_code: 11 }] }),
    });

    expect(response.status).toBe(502);
    expect(body).toMatchObject({ ok: false, error: { code: 'server' } });
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it.each([
    ['a GET', { method: 'GET', origin: SITE }],
    [
      'a POST from another site',
      { method: 'POST', origin: 'https://evil.test' },
    ],
    ['a POST that says nothing of where it comes from', { method: 'POST' }],
  ])('changes nothing for %s', async (_case, options) => {
    const { response, fetch } = await visit(MARK_QUERY, options);

    expect([403, 405]).toContain(response.status);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('only reads with a GET', async () => {
    const { response, fetch } = await visit(STATES_QUERY, change);

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['no resource', 'type=movie&id=603'],
    ['a person', STATES_QUERY.replace('movie', 'person')],
    ['an id that is not a number', STATES_QUERY.replace('603', '603x')],
    ['a list the app does not use', LIST_QUERY.replace('favorite', 'rated')],
    ['a page past the last one', LIST_QUERY.replace('page=1', 'page=501')],
  ])('refuses %s without asking TMDB', async (_case, query) => {
    const { response, body, fetch } = await visit(query);

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: { code: 'invalid-request' } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a change that is not true or false', async () => {
    const { response, fetch } = await visit(
      MARK_QUERY.replace('value=true', 'value=yes'),
      change,
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
