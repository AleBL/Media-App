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

  it('shows who is signed in', async () => {
    useSessionStore().state = SIGNED_IN;
    await mountNavBar();

    expect(wrapper.get('a[href="/account"]').text()).toBe('Ada Lovelace');
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
