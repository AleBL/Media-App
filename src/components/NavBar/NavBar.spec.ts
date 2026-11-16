import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import i18n from '@/plugins/i18n';
import NavBar from '@/components/NavBar/NavBar.vue';
import { useSessionStore } from '@/stores/session';
import { installFakeApi, SIGNED_IN } from '@/test/fakeApi';

describe('NavBar', () => {
  let api: ReturnType<typeof installFakeApi>;
  let wrapper: VueWrapper;

  async function mountNavBar() {
    const router = createRouter({
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

  const links = () =>
    wrapper.findAll('#main-menu > li > a').map((link) => ({
      href: link.attributes('href'),
      text: link.text(),
    }));
  const languageButton = () => wrapper.get('[aria-controls="language-menu"]');
  const languageMenu = () => wrapper.get('#language-menu');

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('leads to every page of the desktop app', async () => {
    await mountNavBar();

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Main menu');
    expect(links()).toEqual([
      { href: '/home', text: 'Home Page' },
      { href: '/search', text: 'Search' },
      { href: '/settings', text: 'Settings' },
      { href: '/about', text: 'About Page' },
      { href: '/account', text: 'Sign in' },
    ]);
    expect(wrapper.get('a[href="/search"]').attributes('aria-current')).toBe(
      'page',
    );
  });

  it('has no settings on the web', async () => {
    api.platform = 'web';
    await mountNavBar();

    expect(links().map((link) => link.href)).not.toContain('/settings');
  });

  it('shows who is signed in, with a menu of their own', async () => {
    useSessionStore().state = SIGNED_IN;
    await mountNavBar();

    const button = wrapper.get('[aria-controls="account-menu"]');
    const menu = wrapper.get('#account-menu');

    expect(button.text()).toBe('Ada Lovelace');
    expect(links().map((link) => link.href)).not.toContain('/account');
    expect(menu.isVisible()).toBe(false);

    await button.trigger('click');

    expect(button.attributes('aria-expanded')).toBe('true');
    expect(
      menu.findAll('a').map((link) => [link.attributes('href'), link.text()]),
    ).toEqual([
      ['/watchlist', 'My list'],
      ['/favorites', 'Favorites'],
      ['/account', 'Account'],
    ]);

    await menu.get('button').trigger('click');
    await flushPromises();

    expect(api.auth.logout).toHaveBeenCalled();
    expect(wrapper.find('[aria-controls="account-menu"]').exists()).toBe(false);
    expect(links().map((link) => link.text)).toContain('Sign in');
  });

  it('shows the picture of whoever signed in, when TMDB has one', async () => {
    useSessionStore().state = {
      status: 'authenticated',
      account: { id: 7, username: 'ada', avatarPath: '/ada.jpg' },
    };
    await mountNavBar();

    expect(
      wrapper.get('[aria-controls="account-menu"] img').attributes('src'),
    ).toBe('https://image.tmdb.org/t/p/w45/ada.jpg');
  });

  it('closes the menu of the account with Escape, back on its button', async () => {
    useSessionStore().state = SIGNED_IN;
    await mountNavBar();
    const button = wrapper.get('[aria-controls="account-menu"]');

    await button.trigger('click');
    button.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await flushPromises();

    expect(wrapper.get('#account-menu').isVisible()).toBe(false);
    expect(document.activeElement).toBe(button.element);
  });

  it('switches the language from its own menu', async () => {
    await mountNavBar();
    expect(languageButton().attributes('aria-expanded')).toBe('false');
    expect(languageMenu().isVisible()).toBe(false);

    await languageButton().trigger('click');

    expect(languageButton().attributes('aria-expanded')).toBe('true');
    expect(languageMenu().isVisible()).toBe(true);
    const options = languageMenu().findAll('button');
    expect(options.map((option) => option.text())).toEqual([
      'en',
      'es',
      'pt-BR',
    ]);
    expect(options[0].attributes('aria-current')).toBe('true');

    await options[2].trigger('click');

    expect(i18n.global.locale.value).toBe('pt-BR');
    expect(languageMenu().isVisible()).toBe(false);
    expect(wrapper.get('a[href="/search"]').text()).toBe('Procurar');
  });

  it('closes the languages with Escape, back on their button', async () => {
    await mountNavBar();
    await languageButton().trigger('click');

    languageButton().element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await flushPromises();

    expect(languageMenu().isVisible()).toBe(false);
    expect(document.activeElement).toBe(languageButton().element);
  });

  it('folds the menu behind a button on narrow windows', async () => {
    await mountNavBar();
    const toggle = wrapper.get('[aria-controls="main-menu"]');

    expect(toggle.attributes('aria-label')).toBe('Menu');
    expect(toggle.attributes('aria-expanded')).toBe('false');

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');

    // Following a link folds it again.
    await wrapper.get('a[href="/about"]').trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('false');
  });
});
