import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { SessionState } from '@shared/api';
import router from '@/router';
import { useSessionStore } from '@/stores/session';
import { installFakeApi, SIGNED_IN } from '@/test/fakeApi';
import { pageAfterSignIn } from '@/util/signIn';

describe('router', () => {
  it('uses hash based urls so routes resolve under file://', () => {
    expect(router.resolve({ name: 'search' }).href).toBe('#/search');
    expect(router.resolve({ name: 'about' }).href).toBe('#/about');
    expect(router.resolve({ name: 'settings' }).href).toBe('#/settings');
    expect(router.resolve({ name: 'account' }).href).toBe('#/account');
    expect(router.resolve({ name: 'watchlist' }).href).toBe('#/watchlist');
    expect(router.resolve({ name: 'favorites' }).href).toBe('#/favorites');
    expect(router.resolve({ name: 'rated' }).href).toBe('#/rated');
  });

  it('redirects the entry route to home', async () => {
    await router.push('/');
    expect(router.currentRoute.value.name).toBe('home');
  });

  it('opens the page of a movie or tv show by its type and id', async () => {
    expect(
      router.resolve({ name: 'details', params: { type: 'tv', id: 1396 } })
        .href,
    ).toBe('#/tv/1396');

    await router.push('/movie/603');

    expect(router.currentRoute.value.name).toBe('details');
  });

  it.each(['/person/31', '/movie/matrix'])(
    'has no page for %s',
    async (path) => {
      await router.push(path);

      expect(router.currentRoute.value.name).not.toBe('details');
    },
  );

  it('starts a new page at the top, and goes back to where the user was', () => {
    const scroll = router.options.scrollBehavior!;
    const route = router.currentRoute.value;

    expect(scroll(route, route, null)).toEqual({ top: 0 });
    expect(scroll(route, route, { left: 0, top: 1200 })).toEqual({
      left: 0,
      top: 1200,
    });
  });
});

describe('pages of the account', () => {
  let api: ReturnType<typeof installFakeApi>;

  beforeEach(async () => {
    api = installFakeApi();
    setActivePinia(createPinia());
    await router.replace('/home');
  });

  afterEach(() => {
    delete window.api;
  });

  it.each(['/watchlist', '/favorites', '/rated', '/watched'])(
    'send nobody signed in to the sign in, which comes back to %s',
    async (page) => {
      await useSessionStore().load();

      await router.push(page);

      expect(router.currentRoute.value.name).toBe('account');
      expect(router.currentRoute.value.query.next).toBe(page);
    },
  );

  it('open for whoever signed in', async () => {
    useSessionStore().state = SIGNED_IN;

    await router.push('/favorites');

    expect(router.currentRoute.value.name).toBe('favorites');
  });

  it('wait for the app to know who is signed in', async () => {
    let answer!: (state: SessionState) => void;
    api.auth.getSession.mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );
    const session = useSessionStore();

    const going = router.push('/watchlist');
    void session.load();
    answer(SIGNED_IN);
    await going;

    expect(router.currentRoute.value.name).toBe('watchlist');
  });

  it('leave the other pages alone', async () => {
    await router.push('/search');

    expect(router.currentRoute.value.name).toBe('search');
    expect(api.auth.getSession).not.toHaveBeenCalled();
  });
});

describe('where the sign in goes back to', () => {
  it.each([
    ['/watchlist', '/watchlist'],
    ['/tv/1396', '/tv/1396'],
    ['/search', '/search'],
  ])('a page of the app: %s', (next, page) => {
    expect(pageAfterSignIn(router, next)).toBe(page);
  });

  it.each([
    ['nothing', undefined],
    ['several', ['/watchlist', '/favorites']],
    ['an address of another site', '//evil.test/watchlist'],
    ['a full address', 'https://evil.test/'],
    ['no page of the app', '/nowhere'],
    ['the sign in itself', '/account'],
  ])('never %s', (_case, next) => {
    expect(pageAfterSignIn(router, next)).toBeNull();
  });
});
