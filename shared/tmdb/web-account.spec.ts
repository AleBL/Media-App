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
const RATE = 'POST /3/movie/603/rating';
const UNRATE = 'DELETE /3/movie/603/rating';
const RATED = 'GET /3/account/7/rated/movies';

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
    [RATE]: [201, { status_code: 1 }],
    [UNRATE]: [200, { status_code: 13 }],
    [RATED]: [
      200,
      {
        page: 1,
        results: [{ id: 603, title: 'The Matrix', rating: 8.5 }],
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
  /** More cookies of the site, by name. */
  cookies?: Record<string, string>;
}

async function visit(query: string, options: Options = {}) {
  const fetch = options.fetch ?? tmdbWith();
  const account = createWebAccount({ credential: TOKEN, fetch });
  const session = options.session === undefined ? SESSION : options.session;
  const headers: Record<string, string> = {};
  const cookies = Object.entries({
    ...(session ? { [KEPT]: session } : {}),
    ...options.cookies,
  });

  if (cookies.length) {
    headers.cookie = cookies.map((pair) => pair.join('=')).join('; ');
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
const RATE_QUERY = 'resource=rate&type=movie&id=603&value=8.5';
const UNRATE_QUERY = 'resource=unrate&type=movie&id=603';

/** A change, the way the app itself sends it. */
const change = { method: 'POST', origin: SITE };

describe('web account', () => {
  it('says where a title is, with the session of the cookie', async () => {
    const { response, body, fetch } = await visit(STATES_QUERY);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: { watchlist: true, favorite: false, rated: null },
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

  it('rates a title, with the session alone', async () => {
    const { response, body, fetch } = await visit(RATE_QUERY, change);

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: null });
    // a rating is under the title: no need to ask whose account it is
    expect(asked(fetch)).toEqual([RATE]);
    expect(JSON.parse(fetch.mock.calls[0][1].body!)).toEqual({ value: 8.5 });
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get('session_id')).toBe(
      SESSION,
    );
  });

  it('takes the rating of a title away', async () => {
    const { response, body, fetch } = await visit(UNRATE_QUERY, change);

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: null });
    expect(asked(fetch)).toEqual([UNRATE]);
  });

  it('reads a page of the rated titles, each with its rating', async () => {
    const { body, fetch } = await visit(
      'resource=list&list=rated&type=movie&page=1&language=en',
    );

    expect(body).toMatchObject({
      ok: true,
      data: {
        results: [{ id: 603, media_type: 'movie', rating: 8.5 }],
      },
    });
    expect(asked(fetch)).toEqual([ACCOUNT, RATED]);
  });

  it('never puts the session in what it answers', async () => {
    for (const [query, options] of [
      [STATES_QUERY, {}],
      [MARK_QUERY, change],
      [LIST_QUERY, {}],
      [RATE_QUERY, change],
      [UNRATE_QUERY, change],
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
    // with what the v4 login kept besides the session
    expect(response.headers.getSetCookie()).toEqual(
      [
        KEPT,
        '__Host-media-app-access',
        '__Host-media-app-account',
        '__Host-media-app-watched-list',
        '__Host-media-app-episodes-list',
      ].map(
        (name) => `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`,
      ),
    );
  });

  describe('recommendations', () => {
    const USER = 'u.s.r';
    const OBJECT = '5f0c4a1b2c3d4e5f6a7b8c9d';
    const v4 = {
      '__Host-media-app-access': USER,
      '__Host-media-app-account': OBJECT,
    };
    const RECOMMENDED = `GET /4/account/${OBJECT}/tv/recommendations`;
    const QUERY = 'resource=recommendations&type=tv&language=pt-BR';

    it('reads what TMDB recommends to the account, with the access token of the user', async () => {
      const fetch = tmdbWith({
        [RECOMMENDED]: [
          200,
          {
            page: 1,
            results: [{ id: 1396, media_type: 'tv', name: 'Breaking Bad' }],
            total_pages: 1,
            total_results: 1,
          },
        ],
      });
      const { body } = await visit(QUERY, { cookies: v4, fetch });

      expect(body).toMatchObject({
        ok: true,
        data: [{ id: 1396, media_type: 'tv', name: 'Breaking Bad' }],
      });
      expect(asked(fetch)).toEqual([RECOMMENDED]);
      expect(new URL(fetch.mock.calls[0][0]).searchParams.get('language')).toBe(
        'pt-BR',
      );
      expect(fetch.mock.calls[0][1].headers.Authorization).toBe(
        `Bearer ${USER}`,
      );
    });

    it('asks to sign in again without the access token of the user', async () => {
      const { response, body, fetch } = await visit(QUERY);

      expect(response.status).toBe(403);
      expect(body).toEqual({ ok: false, error: { code: 'sign-in-again' } });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('refuses a type that is not one, without asking TMDB', async () => {
      const { response, fetch } = await visit(
        'resource=recommendations&type=person&language=en',
        { cookies: v4 },
      );

      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('watched titles', () => {
    const USER = 'u.s.r';
    const OBJECT = '5f0c4a1b2c3d4e5f6a7b8c9d';
    const LIST_COOKIE = '__Host-media-app-watched-list';
    const v4 = {
      '__Host-media-app-access': USER,
      '__Host-media-app-account': OBJECT,
    };
    const LISTS = `GET /4/account/${OBJECT}/lists`;
    const STATUS = 'GET /4/list/77/item_status';
    const ADD = 'POST /4/list/77/items';
    const COMMENT = 'PUT /4/list/77/items';
    const PAGE = 'GET /4/list/77';
    const withList = () =>
      tmdbWith({
        [LISTS]: [
          200,
          {
            page: 1,
            results: [
              { id: 77, name: 'Watched', description: 'media-app:watched' },
            ],
            total_pages: 1,
          },
        ],
        [STATUS]: [200, { success: true, media_id: 603 }],
        [ADD]: [200, { success: true }],
        [COMMENT]: [200, { success: true }],
        [PAGE]: [
          200,
          {
            page: 1,
            results: [{ id: 603, media_type: 'movie', title: 'The Matrix' }],
            comments: { 'movie:603': '2026-11-16' },
            total_pages: 1,
            total_results: 1,
          },
        ],
      });
    const STATE_QUERY = 'resource=watched-state&type=movie&id=603';
    const WATCH_QUERY =
      'resource=watched-mark&type=movie&id=603&value=true&date=2026-11-16&language=en';

    it('says whether a title was watched, with the access token of the user', async () => {
      const { response, body, fetch } = await visit(STATE_QUERY, {
        cookies: v4,
        fetch: withList(),
      });

      expect(body).toEqual({ ok: true, data: true });
      expect(asked(fetch)).toEqual([LISTS, STATUS]);
      expect(
        fetch.mock.calls.map(([, init]) => init.headers.Authorization),
      ).toEqual([`Bearer ${USER}`, `Bearer ${USER}`]);
      // the list is looked for once: its id stays with the browser
      expect(response.headers.getSetCookie()).toEqual([
        `${LIST_COOKIE}=77; Path=/; Max-Age=${180 * 24 * 60 * 60}; HttpOnly; SameSite=Lax; Secure`,
      ]);
    });

    it('goes straight to the list it found before', async () => {
      const { fetch } = await visit(STATE_QUERY, {
        cookies: { ...v4, [LIST_COOKIE]: '77' },
        fetch: withList(),
      });

      expect(asked(fetch)).toEqual([STATUS]);
    });

    it('marks a title watched, on the day of the user, with a change from the site', async () => {
      const { body, fetch } = await visit(WATCH_QUERY, {
        ...change,
        cookies: { ...v4, [LIST_COOKIE]: '77' },
        fetch: withList(),
      });

      expect(body).toEqual({ ok: true, data: null });
      expect(asked(fetch)).toEqual([ADD, COMMENT]);
      expect(JSON.parse(fetch.mock.calls[1][1].body!)).toEqual({
        items: [{ media_type: 'movie', media_id: 603, comment: '2026-11-16' }],
      });
    });

    it('reads a page of the watched titles', async () => {
      const { body } = await visit('resource=watched-list&page=1&language=en', {
        cookies: { ...v4, [LIST_COOKIE]: '77' },
        fetch: withList(),
      });

      expect(body).toMatchObject({
        ok: true,
        data: { results: [{ id: 603, watchedAt: '2026-11-16' }] },
      });
    });

    it('asks to sign in again without the access token of the user', async () => {
      const { response, body, fetch } = await visit(STATE_QUERY);

      expect(response.status).toBe(403);
      expect(body).toEqual({ ok: false, error: { code: 'sign-in-again' } });
      expect(fetch).not.toHaveBeenCalled();
    });

    it.each([
      ['a GET', { method: 'GET', origin: SITE }],
      [
        'a POST from another site',
        { method: 'POST', origin: 'https://x.test' },
      ],
    ])('changes nothing for %s', async (_case, options) => {
      const { response, fetch } = await visit(WATCH_QUERY, {
        ...options,
        cookies: v4,
      });

      expect([403, 405]).toContain(response.status);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('refuses a day that is not one, without asking TMDB', async () => {
      const { response, fetch } = await visit(
        WATCH_QUERY.replace('2026-11-16', '2026-13-01'),
        { ...change, cookies: v4 },
      );

      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    });

    describe('their episodes', () => {
      const EPISODES_COOKIE = '__Host-media-app-episodes-list';
      const EPISODE_STATUS = 'GET /4/list/99/item_status';
      const EPISODE_COMMENT = 'PUT /4/list/99/items';
      const withEpisodes = () =>
        tmdbWith({
          [EPISODE_STATUS]: [200, { success: true, media_id: 1396 }],
          [EPISODE_COMMENT]: [
            200,
            { success: true, results: [{ media_id: 1396, success: true }] },
          ],
          'GET /4/list/99': [
            200,
            {
              page: 1,
              results: [{ id: 1396, media_type: 'tv', name: 'Breaking Bad' }],
              comments: { 'tv:1396': '2026-11-20;1:1-3' },
              total_pages: 1,
            },
          ],
        });
      const SAVE_QUERY =
        'resource=watched-save-progress&id=1396&seasons=1%3A1-3%2C5%3B2%3A1&date=2026-11-20&language=en';

      it('reads every show with an episode watched, from their own list', async () => {
        const { body, fetch } = await visit('resource=watched-progress', {
          cookies: { ...v4, [LIST_COOKIE]: '77', [EPISODES_COOKIE]: '99' },
          fetch: withEpisodes(),
        });

        expect(body).toEqual({
          ok: true,
          data: [
            { id: 1396, seasons: { 1: [1, 2, 3] }, changedAt: '2026-11-20' },
          ],
        });
        expect(asked(fetch)).toEqual(['GET /4/list/99']);
      });

      it('saves the episodes of a show, with a change from the site', async () => {
        const { body, fetch } = await visit(SAVE_QUERY, {
          ...change,
          cookies: { ...v4, [EPISODES_COOKIE]: '99' },
          fetch: withEpisodes(),
        });

        expect(body).toEqual({ ok: true, data: null });
        expect(asked(fetch)).toEqual([EPISODE_STATUS, EPISODE_COMMENT]);
        expect(JSON.parse(fetch.mock.calls[1][1].body!)).toEqual({
          items: [
            {
              media_type: 'tv',
              media_id: 1396,
              comment: '2026-11-20;1:1-3,5;2:1',
            },
          ],
        });
      });

      it.each([
        ['seasons it cannot read', SAVE_QUERY.replace('1%3A1-3', '1%3Ax')],
        ['more than a comment holds', `${SAVE_QUERY}${'%2C9'.repeat(2000)}`],
        ['no show', SAVE_QUERY.replace('id=1396', 'id=0')],
      ])('refuses %s, without asking TMDB', async (_case, query) => {
        const { response, fetch } = await visit(query, {
          ...change,
          cookies: v4,
        });

        expect(response.status).toBe(400);
        expect(fetch).not.toHaveBeenCalled();
      });

      it('changes nothing for a GET', async () => {
        const { response, fetch } = await visit(SAVE_QUERY, { cookies: v4 });

        expect(response.status).toBe(405);
        expect(fetch).not.toHaveBeenCalled();
      });
    });
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
    for (const query of [MARK_QUERY, RATE_QUERY, UNRATE_QUERY]) {
      const { response, fetch } = await visit(query, options);

      expect([403, 405]).toContain(response.status);
      expect(fetch).not.toHaveBeenCalled();
    }
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
    ['a list the app does not use', LIST_QUERY.replace('favorite', 'lists')],
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

  it.each([
    ['above 10', RATE_QUERY.replace('8.5', '11')],
    ['between two steps', RATE_QUERY.replace('8.5', '8.25')],
    ['zero', RATE_QUERY.replace('8.5', '0')],
    ['that is not a number', RATE_QUERY.replace('8.5', 'ten')],
    ['missing', 'resource=rate&type=movie&id=603'],
  ])('refuses a rating %s, without asking TMDB', async (_case, query) => {
    const { response, fetch } = await visit(query, change);

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
