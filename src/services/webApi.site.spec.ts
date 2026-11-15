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
    const tmdb = vi.fn<FetchLike>(async (url) => {
      const { pathname } = new URL(url);
      const body = pathname.endsWith('/token/new')
        ? { request_token: 'a'.repeat(40) }
        : pathname.endsWith('/session/new')
          ? { session_id: 'b'.repeat(40) }
          : { id: 7, username: 'ada', name: 'Ada Lovelace' };

      return new Response(JSON.stringify(body));
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
    const back = new URL(approval.searchParams.get('redirect_to')!);

    back.searchParams.set(
      'request_token',
      approval.pathname.split('/').at(-1)!,
    );
    back.searchParams.set('approved', 'true');

    const toApp = await visit(back.toString());

    expect(approval.hostname).toBe('www.themoviedb.org');
    expect(toApp.headers.get('Location')).toBe('/#/account');
    expect([...cookies.keys()]).toEqual(['__Host-media-app-session']);
    expect(await api.auth.getSession()).toEqual(signedIn);

    expect(await api.auth.logout()).toEqual({ status: 'anonymous' });
    expect(await api.auth.getSession()).toEqual({ status: 'anonymous' });
    expect(cookies.size).toBe(0);
  });
});
