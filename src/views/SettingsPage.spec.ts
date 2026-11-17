import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import i18n from '@/plugins/i18n';
import { useSettingsStore } from '@/stores/settings';
import SettingsPage from '@/views/SettingsPage.vue';
import { installFakeApi, NO_ACCESS, SAVED_KEY } from '@/test/fakeApi';

describe('SettingsPage', () => {
  let api: ReturnType<typeof installFakeApi>;
  let wrapper: VueWrapper;

  async function mountPage() {
    const pinia = createPinia();
    setActivePinia(pinia);
    wrapper = mount(SettingsPage, {
      global: { plugins: [pinia, i18n] },
    });
    await flushPromises();
  }

  beforeEach(() => {
    localStorage.clear();
    i18n.global.locale.value = 'en';
    api = installFakeApi();
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('presents the key as optional when the app has its own access', async () => {
    await mountPage();

    expect(wrapper.get('h1').text()).toBe('Settings');
    expect(wrapper.text()).toContain('so this is optional');
    expect(wrapper.text()).not.toContain('built without access');
    expect(wrapper.find('input').exists()).toBe(true);
  });

  it('asks for a key when the app was built without access', async () => {
    api.credentials.status.mockResolvedValue(NO_ACCESS);

    await mountPage();

    expect(wrapper.text()).toContain('built without access');
    expect(wrapper.text()).not.toContain('so this is optional');
  });

  it('says neither before the main process answered', async () => {
    api.credentials.status.mockReturnValue(new Promise(() => {}));

    await mountPage();

    expect(wrapper.text()).not.toContain('so this is optional');
    expect(wrapper.text()).not.toContain('built without access');
  });

  it('has no key and no cache on the web, which keeps neither', async () => {
    api.platform = 'web';

    await mountPage();

    expect(wrapper.find('#own-key').exists()).toBe(false);
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Clear cache');
    // the rest is the same
    expect(wrapper.find('#settings-language').exists()).toBe(true);
    expect(wrapper.find('#settings-region').exists()).toBe(true);
  });

  it('changes the language, kept for the next launch', async () => {
    await mountPage();

    const select = wrapper.get('#settings-language');
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      'English',
      'Español',
      'Português (Brasil)',
    ]);

    await select.setValue('pt-BR');

    expect(i18n.global.locale.value).toBe('pt-BR');
    expect(localStorage.getItem('locale')).toBe('pt-BR');
    expect(wrapper.get('h1').text()).toBe('Configurações');
  });

  it('follows the system, or keeps the theme light or dark', async () => {
    await mountPage();

    expect(
      (wrapper.get('#settings-theme-auto').element as HTMLInputElement).checked,
    ).toBe(true);

    await wrapper.get('#settings-theme-dark').setValue(true);
    await flushPromises();

    expect(localStorage.getItem('vueuse-color-scheme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await wrapper.get('#settings-theme-auto').setValue(true);
  });

  it('chooses the country of where to watch, among those TMDB knows', async () => {
    await mountPage();

    const select = wrapper.get('#settings-region');
    const options = select.findAll('option');
    expect(options[0].text()).toBe('Automatic (United States)');
    expect(options.slice(1).map((option) => option.text())).toEqual([
      'Brazil',
      'Germany',
      'Portugal',
      'United States',
    ]);

    await select.setValue('PT');

    expect(useSettingsStore().region).toBe('PT');
    expect(useSettingsStore().regionFor('en')).toBe('PT');
    expect(localStorage.getItem('region')).toBe('PT');
  });

  it('keeps the country chosen when TMDB cannot list them', async () => {
    localStorage.setItem('region', 'PT');
    api.tmdb.regions.mockResolvedValue({
      ok: false,
      error: { code: 'network' },
    });

    await mountPage();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'The list of countries could not be loaded.',
    );
    expect(
      (wrapper.get('#settings-region').element as HTMLSelectElement).value,
    ).toBe('PT');
  });

  it('clears the cache, and says so', async () => {
    await mountPage();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Clear cache')!
      .trigger('click');
    await flushPromises();

    expect(api.clearCache).toHaveBeenCalledOnce();
    expect(wrapper.get('[role="status"]').text()).toBe('Cache cleared.');
  });

  it('says when the cache could not be cleared', async () => {
    api.clearCache.mockResolvedValue({ ok: false, error: { code: 'server' } });
    await mountPage();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Clear cache')!
      .trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="status"]').text()).toBe(
      'The cache could not be cleared. Try again.',
    );
  });

  it('links to the page of TMDB where keys are created', async () => {
    api.credentials.status.mockResolvedValue(SAVED_KEY);

    await mountPage();

    const link = wrapper.get('a');
    expect(link.attributes('href')).toBe(
      'https://www.themoviedb.org/settings/api',
    );
    expect(link.attributes('target')).toBe('_blank');
  });
});
