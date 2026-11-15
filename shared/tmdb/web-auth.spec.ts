// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { SessionState } from '../api';
import type { FetchLike } from './client';
import { createWebAuth } from './web-auth';

const TOKEN = 'site.read-access.token';
const SITE = 'https://media-app.test';
const REQUEST_TOKEN = 'a'.repeat(40);
const SESSION = 'b'.repeat(40);
const OLD_SESSION = 'c'.repeat(40);

const LOGIN = '__Host-media-app-login';
const KEPT = '__Host-media-app-session';
const FAILURE = '__Host-media-app-login-failure';

type Answer = [status: number, body: unknown];

const TOKEN_NEW = 'GET /3/authentication/token/new';
const SESSION_NEW = 'POST /3/authentication/session/new';
const SESSION_END = 'DELETE /3/authentication/session';
const ACCOUNT = 'GET /3/account';

const REFUSED: Answer = [401, { status_code: 17, status_message: 'Denied.' }];
const BROKEN: Answer = [500, { status_code: 11 }];

/** A TMDB where everything works, except what `answers` says otherwise. */
function tmdbWith(answers: Record<string, Answer> = {}) {
  const all: Record<string, Answer> = {
    [TOKEN_NEW]: [200, { success: true, request_token: REQUEST_TOKEN }],
    [SESSION_NEW]: [200, { success: true, session_id: SESSION }],
    [SESSION_END]: [200, { success: true }],
    [ACCOUNT]: [
      200,
      {
        id: 7,
        username: 'ada',
        name: 'Ada Lovelace',
        include_adult: true,
        avatar: { tmdb: { avatar_path: '/ada.png' } },
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

const unreachable = () =>
  vi.fn<FetchLike>(async () => {
    throw new TypeError('fetch failed');
  });

/** What TMDB was asked, as `METHOD /path` lines. */
const asked = (fetch: ReturnType<typeof tmdbWith>) =>
  fetch.mock.calls.map(
    ([url, init]) => `${init.method ?? 'GET'} ${new URL(url).pathname}`,
  );

interface Options {
  fetch?: ReturnType<typeof tmdbWith>;
  cookies?: Record<string, string>;
  method?: string;
  headers?: Record<string, string>;
  site?: string;
  credential?: string;
}

async function visit(path: string, options: Options = {}) {
  const fetch = options.fetch ?? tmdbWith();
  const auth = createWebAuth({
    credential: 'credential' in options ? options.credential : TOKEN,
    fetch,
  });
  const cookie = Object.entries(options.cookies ?? {})
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  const response = await auth(
    new Request(`${options.site ?? SITE}${path}`, {
      method: options.method ?? 'GET',
      headers: { ...(cookie ? { cookie } : {}), ...options.headers },
    }),
  );
  // name → [value, ...attributes]
  const set = new Map(
    response.headers.getSetCookie().map((line) => {
      const [pair, ...attributes] = line.split('; ');
      const at = pair.indexOf('=');

      return [pair.slice(0, at), [pair.slice(at + 1), ...attributes]] as const;
    }),
  );

  return { response, set, fetch };
}

const state = (response: Response) => response.json() as Promise<SessionState>;

const CLEARED = ['', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];

describe('web auth', () => {
  describe('login', () => {
    it('sends the browser to the approval page of TMDB, with the way back to the site', async () => {
      const { response, fetch } = await visit('/api/auth/login');

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(
        `https://www.themoviedb.org/authenticate/${REQUEST_TOKEN}` +
          `?redirect_to=${encodeURIComponent(`${SITE}/api/auth/callback`)}`,
      );
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(asked(fetch)).toEqual([TOKEN_NEW]);
      expect(fetch.mock.calls[0][1].headers.Authorization).toBe(
        `Bearer ${TOKEN}`,
      );
    });

    it('keeps the request token in a cookie that scripts cannot read', async () => {
      const { set } = await visit('/api/auth/login', {
        cookies: { [FAILURE]: 'denied' },
      });

      expect(set.get(LOGIN)).toEqual([
        REQUEST_TOKEN,
        'Path=/',
        'Max-Age=3600',
        'HttpOnly',
        'SameSite=Lax',
        'Secure',
      ]);
      // a failure of an earlier login is not told after a new one starts
      expect(set.get(FAILURE)).toEqual([...CLEARED, 'Secure']);
      expect(set.has(KEPT)).toBe(false);
    });

    it('goes by the address the browser used, behind the proxy of the host', async () => {
      const { response, set } = await visit('/api/auth/login', {
        site: 'http://internal:3000',
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'media.example.com',
        },
      });

      expect(
        new URL(response.headers.get('Location')!).searchParams.get(
          'redirect_to',
        ),
      ).toBe('https://media.example.com/api/auth/callback');
      expect(set.get(LOGIN)).toContain('Secure');
    });

    it('works over plain http, for the dev server', async () => {
      const { response, set } = await visit('/api/auth/login', {
        site: 'http://localhost:5173',
      });

      expect(
        new URL(response.headers.get('Location')!).searchParams.get(
          'redirect_to',
        ),
      ).toBe('http://localhost:5173/api/auth/callback');
      // no `__Host-` prefix and no Secure: a browser would refuse them here
      expect(set.get('media-app-login')).toEqual([
        REQUEST_TOKEN,
        'Path=/',
        'Max-Age=3600',
        'HttpOnly',
        'SameSite=Lax',
      ]);
    });

    it.each([
      ['TMDB cannot be reached', { fetch: unreachable() }, 'network'],
      [
        'TMDB is failing',
        { fetch: tmdbWith({ [TOKEN_NEW]: BROKEN }) },
        'network',
      ],
      [
        'TMDB refuses the credential of the site',
        { fetch: tmdbWith({ [TOKEN_NEW]: [401, { status_code: 7 }] }) },
        'unavailable',
      ],
      ['the site has no credential', { credential: '' }, 'unavailable'],
      [
        'TMDB answers something else',
        { fetch: tmdbWith({ [TOKEN_NEW]: [200, { success: true }] }) },
        'network',
      ],
    ] satisfies [string, Options, string][])(
      'goes back to the app with the reason when %s',
      async (_case, options, reason) => {
        const { response, set } = await visit('/api/auth/login', options);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe('/#/account');
        expect(set.get(FAILURE)?.slice(0, 3)).toEqual([
          reason,
          'Path=/',
          'Max-Age=60',
        ]);
        expect(set.has(LOGIN)).toBe(false);
      },
    );

    it('can send the browser to a stand-in for the TMDB website, for tests', async () => {
      const auth = createWebAuth({
        credential: TOKEN,
        fetch: tmdbWith(),
        authorizeUrl: 'http://127.0.0.1:4321/authenticate',
      });

      const response = await auth(new Request(`${SITE}/api/auth/login`));

      expect(response.headers.get('Location')).toBe(
        `http://127.0.0.1:4321/authenticate/${REQUEST_TOKEN}` +
          `?redirect_to=${encodeURIComponent(`${SITE}/api/auth/callback`)}`,
      );
    });

    it('does not ask TMDB when the site has no credential', async () => {
      const { fetch } = await visit('/api/auth/login', { credential: '' });

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('callback', () => {
    const back = `/api/auth/callback?request_token=${REQUEST_TOKEN}&approved=true`;
    const waiting = { [LOGIN]: REQUEST_TOKEN };

    it('trades the request token of the cookie for a session, kept in a cookie', async () => {
      const { response, set, fetch } = await visit(back, { cookies: waiting });

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/#/account');
      expect(asked(fetch)).toEqual([SESSION_NEW]);
      expect(JSON.parse(fetch.mock.calls[0][1].body!)).toEqual({
        request_token: REQUEST_TOKEN,
      });
      expect(set.get(KEPT)).toEqual([
        SESSION,
        'Path=/',
        `Max-Age=${180 * 24 * 60 * 60}`,
        'HttpOnly',
        'SameSite=Lax',
        'Secure',
      ]);
      // traded once
      expect(set.get(LOGIN)).toEqual([...CLEARED, 'Secure']);
      expect(set.get(FAILURE)).toEqual([...CLEARED, 'Secure']);
    });

    it('leaves the login that is waiting alone when the address does not say which it is', async () => {
      const { response, set, fetch } = await visit('/api/auth/callback', {
        cookies: waiting,
      });

      expect(response.headers.get('Location')).toBe('/#/account');
      expect(fetch).not.toHaveBeenCalled();
      expect(set.size).toBe(0);
    });

    it('never trades a token that came in the address', async () => {
      const { response, set, fetch } = await visit(back);

      expect(response.headers.get('Location')).toBe('/#/account');
      expect(fetch).not.toHaveBeenCalled();
      expect(set.size).toBe(0);
    });

    it('leaves the login that is waiting alone when an older one comes back', async () => {
      const { response, set, fetch } = await visit(
        `/api/auth/callback?request_token=${'d'.repeat(40)}&approved=true`,
        { cookies: waiting },
      );

      expect(response.headers.get('Location')).toBe('/#/account');
      expect(fetch).not.toHaveBeenCalled();
      expect(set.size).toBe(0);
    });

    it('says that the access was not approved when TMDB refuses the token', async () => {
      const { response, set } = await visit(
        `/api/auth/callback?request_token=${REQUEST_TOKEN}&denied=true`,
        { cookies: waiting, fetch: tmdbWith({ [SESSION_NEW]: REFUSED }) },
      );

      expect(response.headers.get('Location')).toBe('/#/account');
      expect(set.get(FAILURE)?.[0]).toBe('denied');
      expect(set.get(LOGIN)).toEqual([...CLEARED, 'Secure']);
      expect(set.has(KEPT)).toBe(false);
    });

    it('does not take the word of the address for an approval', async () => {
      const { set } = await visit(back, {
        cookies: waiting,
        fetch: tmdbWith({ [SESSION_NEW]: REFUSED }),
      });

      expect(set.has(KEPT)).toBe(false);
    });

    it.each([
      ['TMDB cannot be reached', unreachable(), 'network'],
      ['TMDB is failing', tmdbWith({ [SESSION_NEW]: BROKEN }), 'network'],
      [
        'TMDB answers something else',
        tmdbWith({ [SESSION_NEW]: [200, { success: true }] }),
        'network',
      ],
      [
        'the session could not go in a cookie',
        tmdbWith({ [SESSION_NEW]: [200, { session_id: 'a; Domain=x' }] }),
        'unavailable',
      ],
    ])('gives the reason when %s', async (_case, fetch, reason) => {
      const { set } = await visit(back, { cookies: waiting, fetch });

      expect(set.get(FAILURE)?.[0]).toBe(reason);
      expect(set.has(KEPT)).toBe(false);
    });

    it('ends the session the browser had before', async () => {
      const { set, fetch } = await visit(back, {
        cookies: { ...waiting, [KEPT]: OLD_SESSION },
      });

      expect(asked(fetch)).toEqual([SESSION_NEW, SESSION_END]);
      expect(JSON.parse(fetch.mock.calls[1][1].body!)).toEqual({
        session_id: OLD_SESSION,
      });
      expect(set.get(KEPT)?.[0]).toBe(SESSION);
    });

    it('ignores a cookie that is not in the shape of a token', async () => {
      const { fetch, set } = await visit(back, {
        cookies: { [LOGIN]: '../../x' },
      });

      expect(fetch).not.toHaveBeenCalled();
      expect(set.size).toBe(0);
    });

    it('does not read the cookies of plain http on https', async () => {
      const { fetch } = await visit(back, {
        cookies: { 'media-app-login': REQUEST_TOKEN },
      });

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('session', () => {
    it('has nobody signed in without a cookie, and does not ask TMDB', async () => {
      const { response, set, fetch } = await visit('/api/auth/session');

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Content-Type')).toContain(
        'application/json',
      );
      expect(await state(response)).toEqual({ status: 'anonymous' });
      expect(fetch).not.toHaveBeenCalled();
      expect(set.size).toBe(0);
    });

    it('says who signed in, and nothing else about the session', async () => {
      const { response, set, fetch } = await visit('/api/auth/session', {
        cookies: { [KEPT]: SESSION },
      });
      const text = await response.text();

      expect(JSON.parse(text)).toEqual({
        status: 'authenticated',
        account: {
          id: 7,
          username: 'ada',
          name: 'Ada Lovelace',
          avatarPath: '/ada.png',
        },
      });
      expect(text).not.toContain(SESSION);
      expect(
        new URL(fetch.mock.calls[0][0]).searchParams.get('session_id'),
      ).toBe(SESSION);
      // renewed: the time counts from the last visit
      expect(set.get(KEPT)?.slice(0, 3)).toEqual([
        SESSION,
        'Path=/',
        `Max-Age=${180 * 24 * 60 * 60}`,
      ]);
    });

    it('signs out a session that ended at TMDB', async () => {
      const { response, set } = await visit('/api/auth/session', {
        cookies: { [KEPT]: SESSION },
        fetch: tmdbWith({ [ACCOUNT]: [401, { status_code: 3 }] }),
      });

      expect(response.status).toBe(200);
      expect(await state(response)).toEqual({ status: 'anonymous' });
      expect(set.get(KEPT)).toEqual([...CLEARED, 'Secure']);
    });

    it.each([
      ['TMDB cannot be reached', unreachable(), 'network'],
      ['TMDB is failing', tmdbWith({ [ACCOUNT]: BROKEN }), 'network'],
      [
        'TMDB refuses the credential of the site',
        tmdbWith({ [ACCOUNT]: [401, { status_code: 7 }] }),
        'unavailable',
      ],
    ])(
      'keeps the session for the next visit when %s',
      async (_case, fetch, reason) => {
        const { response, set } = await visit('/api/auth/session', {
          cookies: { [KEPT]: SESSION },
          fetch,
        });

        expect(response.status).toBe(502);
        expect(await state(response)).toEqual({ status: 'error', reason });
        expect(set.size).toBe(0);
      },
    );

    it('tells once why the last login failed', async () => {
      const { response, set, fetch } = await visit('/api/auth/session', {
        cookies: { [FAILURE]: 'denied' },
      });

      expect(await state(response)).toEqual({
        status: 'error',
        reason: 'denied',
      });
      expect(set.get(FAILURE)).toEqual([...CLEARED, 'Secure']);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('does not repeat a reason it does not know', async () => {
      const { response } = await visit('/api/auth/session', {
        cookies: { [FAILURE]: 'hacked' },
      });

      expect(await state(response)).toEqual({ status: 'anonymous' });
    });

    it('forgets the failure of a login when someone is signed in', async () => {
      const { response, set } = await visit('/api/auth/session', {
        cookies: { [KEPT]: SESSION, [FAILURE]: 'denied' },
      });

      expect((await state(response)).status).toBe('authenticated');
      expect(set.get(FAILURE)).toEqual([...CLEARED, 'Secure']);
    });
  });

  describe('logout', () => {
    const signedIn = { [KEPT]: SESSION, [LOGIN]: REQUEST_TOKEN };
    const fromTheApp = { method: 'POST', headers: { origin: SITE } };

    it('ends the session in the browser and at TMDB', async () => {
      const { response, set, fetch } = await visit('/api/auth/logout', {
        ...fromTheApp,
        cookies: signedIn,
      });

      expect(response.status).toBe(200);
      expect(await state(response)).toEqual({ status: 'anonymous' });
      expect(set.get(KEPT)).toEqual([...CLEARED, 'Secure']);
      expect(set.get(LOGIN)).toEqual([...CLEARED, 'Secure']);
      expect(asked(fetch)).toEqual([SESSION_END]);
      expect(JSON.parse(fetch.mock.calls[0][1].body!)).toEqual({
        session_id: SESSION,
      });
    });

    it('signs out of the browser even when TMDB cannot be reached', async () => {
      const { response, set } = await visit('/api/auth/logout', {
        ...fromTheApp,
        cookies: signedIn,
        fetch: unreachable(),
      });

      expect(await state(response)).toEqual({ status: 'anonymous' });
      expect(set.get(KEPT)).toEqual([...CLEARED, 'Secure']);
    });

    it('has nothing to end at TMDB when nobody is signed in', async () => {
      const { response, fetch } = await visit('/api/auth/logout', fromTheApp);

      expect(await state(response)).toEqual({ status: 'anonymous' });
      expect(fetch).not.toHaveBeenCalled();
    });

    it.each([
      ['another site', { origin: 'https://evil.test' }],
      ['the same host over http', { origin: 'http://media-app.test' }],
      ['nowhere it can tell', {}],
    ] satisfies [string, Record<string, string>][])(
      'refuses a request from %s',
      async (_case, headers) => {
        const { response, set, fetch } = await visit('/api/auth/logout', {
          method: 'POST',
          headers,
          cookies: signedIn,
        });

        expect(response.status).toBe(403);
        expect(set.size).toBe(0);
        expect(fetch).not.toHaveBeenCalled();
      },
    );

    it('compares with the address the browser used, behind the proxy of the host', async () => {
      const { response } = await visit('/api/auth/logout', {
        method: 'POST',
        site: 'http://internal:3000',
        headers: {
          origin: 'https://media.example.com',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'media.example.com',
        },
      });

      expect(response.status).toBe(200);
    });
  });

  it.each([
    ['/api/auth/login', 'POST', 'GET'],
    ['/api/auth/callback', 'POST', 'GET'],
    ['/api/auth/session', 'DELETE', 'GET'],
    ['/api/auth/logout', 'GET', 'POST'],
  ])('only answers %s to the right method', async (path, method, allowed) => {
    const { response, set, fetch } = await visit(path, {
      method,
      headers: { origin: SITE },
      cookies: { [KEPT]: SESSION, [LOGIN]: REQUEST_TOKEN },
    });

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe(allowed);
    expect(set.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers nothing else', async () => {
    const { response, fetch } = await visit('/api/auth/account');

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
});
