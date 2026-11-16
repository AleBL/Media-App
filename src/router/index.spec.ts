import { describe, expect, it } from 'vitest';
import router from '@/router';

describe('router', () => {
  it('uses hash based urls so routes resolve under file://', () => {
    expect(router.resolve({ name: 'search' }).href).toBe('#/search');
    expect(router.resolve({ name: 'about' }).href).toBe('#/about');
    expect(router.resolve({ name: 'settings' }).href).toBe('#/settings');
    expect(router.resolve({ name: 'account' }).href).toBe('#/account');
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
