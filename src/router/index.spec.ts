import { describe, expect, it } from 'vitest';
import router from '@/router';

describe('router', () => {
  it('uses hash based urls so routes resolve under file://', () => {
    expect(router.resolve({ name: 'search' }).href).toBe('#/search');
    expect(router.resolve({ name: 'about' }).href).toBe('#/about');
    expect(router.resolve({ name: 'settings' }).href).toBe('#/settings');
  });

  it('redirects the entry route to home', async () => {
    await router.push('/');
    expect(router.currentRoute.value.name).toBe('home');
  });
});
