// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { FetchLike } from '@shared/tmdb/client';
import { createWebAuth } from '@shared/tmdb/web-auth';
import { createWebApi } from '@/services/webApi';

const SITE = 'https://media-app.test';

// Signing in on the web version, with its two halves put together the way
// the site runs them, and this test in the place of the browser between
// them. It runs outside the DOM of the other tests of the web api because a
// page cannot see the cookies that are the whole point here.
describe('web api together with the sign-in functions of the site', () => {
  it('signs in and out, with the session in a cookie of the site', async () => {
    // TMDB v4, as the access token of the site gets: the request token
    // keeps the way back, and the browser comes back with nothing more.
    let wayBack = '';
    const tmdb = vi.fn<FetchLike>(async (url, init) => {
      const { pathname } = new URL(url);
      const answers: Record<string, unknown> = {
        '/4/auth/request_token': { request_token: 'r.e.q' },
        '/4/auth/access_token': {
          access_token: 'u.s.r',
          account_id: '5f0c4a1b2c3d4e5f6a7b8c9d',
        },
        '/3/authentication/session/convert/4': { session_id: 'b'.repeat(40) },
      };

      if (pathname === '/4/auth/request_token') {
        wayBack = JSON.parse(init.body!).redirect_to;
      }

      return new Response(
        JSON.stringify(
          answers[pathname] ?? { id: 7, username: 'ada', name: 'Ada Lovelace' },
        ),
      );
    });
    const auth = createWebAuth({ credential: 'a.b.c', fetch: tmdb });
    const cookies = new Map<string, string>();
    // What a browser does: sends its cookies, keeps the ones it is given.
    async function visit(url: string, method = 'GET') {
      const response = await auth(
        new Request(new URL(url, SITE), {
          method,
          headers: {
            cookie: [...cookies].map((pair) => pair.join('=')).join('; '),
            origin: SITE,
          },
        }),
      );

      for (const line of response.headers.getSetCookie()) {
        const [pair, ...attributes] = line.split('; ');
        const at = pair.indexOf('=');

        if (attributes.includes('Max-Age=0')) {
          cookies.delete(pair.slice(0, at));
        } else {
          cookies.set(pair.slice(0, at), pair.slice(at + 1));
        }
      }

      return response;
    }
    const navigate = vi.fn<(url: string) => void>();
    const api = createWebApi((url, init) => visit(url, init.method), {
      navigate,
      onRestored: () => {},
    });
    const signedIn = {
      status: 'authenticated',
      account: { id: 7, username: 'ada', name: 'Ada Lovelace' },
    };

    expect(await api.auth.getSession()).toEqual({ status: 'anonymous' });

    void api.auth.login('en');
    // the browser follows: the site, the TMDB website, the site again
    const toTmdb = await visit(navigate.mock.calls[0][0]);
    const approval = new URL(toTmdb.headers.get('Location')!);

    const toApp = await visit(wayBack);

    expect(approval.hostname).toBe('www.themoviedb.org');
    expect(approval.searchParams.get('request_token')).toBe('r.e.q');
    expect(toApp.headers.get('Location')).toBe('/#/account');
    expect([...cookies.keys()].sort()).toEqual([
      '__Host-media-app-access',
      '__Host-media-app-account',
      '__Host-media-app-session',
    ]);
    expect(await api.auth.getSession()).toEqual(signedIn);

    expect(await api.auth.logout()).toEqual({ status: 'anonymous' });
    expect(await api.auth.getSession()).toEqual({ status: 'anonymous' });
    expect(cookies.size).toBe(0);
  });
});
