import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import i18n from '@/plugins/i18n';
import SettingsPage from '@/views/SettingsPage.vue';
import { installFakeApi, NO_ACCESS, SAVED_KEY } from '@/test/fakeApi';

describe('SettingsPage', () => {
  let api: ReturnType<typeof installFakeApi>;
  let wrapper: VueWrapper;

  async function mountPage() {
    const pinia = createPinia();
    setActivePinia(pinia);
    wrapper = mount(SettingsPage, {
      global: { plugins: [pinia, i18n, [PrimeVue, { unstyled: true }]] },
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
