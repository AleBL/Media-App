import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { UpdateState } from '@shared/api';
import UpdateBanner from '@/components/Updates/UpdateBanner.vue';
import i18n from '@/plugins/i18n';
import { installFakeApi } from '@/test/fakeApi';

const RELEASE = 'https://github.com/AleBL/Media-App/releases/tag/v0.3.0';

describe('UpdateBanner', () => {
  let api: ReturnType<typeof installFakeApi>;
  let wrapper: VueWrapper;

  async function mountWith(state: UpdateState) {
    api.updates.state.mockResolvedValue(state);
    const pinia = createPinia();
    setActivePinia(pinia);
    wrapper = mount(UpdateBanner, { global: { plugins: [pinia, i18n] } });
    await flushPromises();
  }

  const button = (name: string) =>
    wrapper.findAll('button').find((it) => it.text() === name);

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('shows nothing while there is no new version', async () => {
    await mountWith({ status: 'idle' });

    expect(wrapper.get('[aria-live="polite"]').text()).toBe('');
  });

  it('shows nothing while the new version downloads', async () => {
    await mountWith({ status: 'downloading', version: '0.3.0' });

    expect(wrapper.get('[aria-live="polite"]').text()).toBe('');
  });

  it('offers to restart into the downloaded version', async () => {
    await mountWith({ status: 'ready', version: '0.3.0' });

    expect(wrapper.get('[aria-live="polite"]').text()).toContain(
      'Version 0.3.0 is ready.',
    );

    await button('Restart and update')!.trigger('click');

    expect(api.updates.install).toHaveBeenCalledOnce();
  });

  it('links to the release where the app cannot update itself', async () => {
    await mountWith({ status: 'available', version: '0.3.0', url: RELEASE });

    const link = wrapper.get('a');

    expect(wrapper.text()).toContain('Version 0.3.0 is available.');
    expect(link.text()).toBe('Download');
    expect(link.attributes()).toMatchObject({
      href: RELEASE,
      target: '_blank',
    });
    expect(button('Restart and update')).toBeUndefined();
  });

  it('closes, until a newer version comes', async () => {
    await mountWith({ status: 'ready', version: '0.3.0' });

    await wrapper.get('button[aria-label="Dismiss"]').trigger('click');

    expect(wrapper.get('[aria-live="polite"]').text()).toBe('');

    api.updates.onChange.mock.calls[0][0]({
      status: 'ready',
      version: '0.4.0',
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Version 0.4.0 is ready.');
  });

  it('speaks the language of the app', async () => {
    i18n.global.locale.value = 'pt-BR';
    await mountWith({ status: 'ready', version: '0.3.0' });

    expect(wrapper.text()).toContain('A versão 0.3.0 está pronta.');
    expect(button('Reiniciar e atualizar')).toBeDefined();
  });
});
