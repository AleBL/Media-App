import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import i18n from '@/plugins/i18n';
import NavBar from '@/components/NavBar/NavBar.vue';
import { useSessionStore } from '@/stores/session';
import { installFakeApi, SIGNED_IN } from '@/test/fakeApi';

describe('NavBar', () => {
  let api: ReturnType<typeof installFakeApi>;
  let router: Router;
  let wrapper: VueWrapper;

  async function mountNavBar() {
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:page(.*)*', component: { template: '<div />' } }],
    });

    await router.push('/search');
    wrapper = mount(NavBar, {
      attachTo: document.body,
      global: { plugins: [i18n, router] },
    });
    await flushPromises();
  }

  // The links of the bar itself, by address and accessible name.
  const links = () =>
    wrapper.findAll('nav a').map((link) => ({
      href: link.attributes('href'),
      name: link.attributes('aria-label') ?? link.text(),
    }));

  // Menus and the drawer open in a layer of their own, at the end of body.
  const layer = (selector: string) => document.body.querySelector(selector);
  const layerAll = (selector: string) =>
    Array.from(document.body.querySelectorAll<HTMLElement>(selector));

  async function open(button: { trigger: VueWrapper['trigger'] }) {
    await button.trigger('keydown', { key: 'Enter' });
    await flushPromises();
  }

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
    document.documentElement.classList.remove('dark');
    delete window.api;
  });

  it('leads home and to the search, with the tools as named icons', async () => {
    await mountNavBar();

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Main menu');
    expect(links()).toEqual([
      { href: '/', name: 'Media App' },
      { href: '/home', name: 'Home' },
      { href: '/search', name: 'Search' },
      { href: '/settings', name: 'Settings' },
      { href: '/about', name: 'About' },
      { href: '/account', name: 'Sign in' },
    ]);
    expect(wrapper.get('a[href="/search"]').attributes('aria-current')).toBe(
      'page',
    );
  });

  it('has the settings on the web too', async () => {
    api.platform = 'web';
    await mountNavBar();

    expect(links().map((link) => link.href)).toContain('/settings');
  });

  it('says what the button of the theme does, and does it', async () => {
    await mountNavBar();
    const button = wrapper.get('button[aria-label^="Switch to"]');

    expect(button.attributes('aria-label')).toBe('Switch to the dark theme');
    expect(button.find('.pi-sun').exists()).toBe(true);

    await button.trigger('click');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(button.attributes('aria-label')).toBe('Switch to the light theme');
    expect(button.find('.pi-moon').exists()).toBe(true);
  });

  it('switches the language from a menu of the languages by their names', async () => {
    await mountNavBar();
    const button = wrapper.get('button[aria-label="Language"]');

    await open(button);

    const options = layerAll('[role="menuitemradio"]');
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'English',
      'Español',
      'Português (Brasil)',
    ]);
    expect(options[0].getAttribute('aria-checked')).toBe('true');

    options[2].click();
    await flushPromises();

    expect(i18n.global.locale.value).toBe('pt-BR');
    expect(layer('[role="menu"]')).toBeNull();
    expect(wrapper.get('a[href="/search"]').text()).toBe('Procurar');
  });

  it('shows who is signed in, with a menu of their own', async () => {
    useSessionStore().state = SIGNED_IN;
    await mountNavBar();
    const button = wrapper.get('[data-account-menu]');

    expect(button.text()).toBe('Ada Lovelace');
    expect(links().map((link) => link.href)).not.toContain('/account');

    await open(button);

    expect(
      layerAll('[role="menu"] a').map((link) => [
        link.getAttribute('href'),
        link.textContent?.trim(),
      ]),
    ).toEqual([
      ['/watchlist', 'My list'],
      ['/favorites', 'Favorites'],
      ['/rated', 'Rated'],
      ['/watched', 'Watched'],
      ['/account', 'Account'],
    ]);

    layerAll('[role="menuitem"]').at(-1)!.click();
    await flushPromises();

    expect(api.auth.logout).toHaveBeenCalled();
    expect(wrapper.find('[data-account-menu]').exists()).toBe(false);
    expect(links().map((link) => link.name)).toContain('Sign in');
  });

  it('shows the picture of whoever signed in, when TMDB has one', async () => {
    useSessionStore().state = {
      status: 'authenticated',
      account: { id: 7, username: 'ada', avatarPath: '/ada.jpg' },
    };
    await mountNavBar();

    expect(wrapper.get('[data-account-menu] img').attributes('src')).toBe(
      'https://image.tmdb.org/t/p/w45/ada.jpg',
    );
  });

  it('keeps the pages in a drawer on narrow windows, closed by a choice', async () => {
    await mountNavBar();
    const toggle = wrapper.get('button[aria-label="Menu"]');

    expect(toggle.attributes('aria-expanded')).toBe('false');

    await toggle.trigger('click');
    await flushPromises();

    const drawer = layer('[role="dialog"]')!;
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(drawer.textContent).toContain('Media App');
    expect(
      Array.from(drawer.querySelectorAll('nav a')).map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(['/home', '/search', '/settings', '/about', '/account']);

    await router.push('/about');
    await flushPromises();

    expect(toggle.attributes('aria-expanded')).toBe('false');
  });
});
