import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import i18n from '@/plugins/i18n';
import OwnKeyInput from '@/components/Settings/OwnKeyInput.vue';
import { installFakeApi, NO_KEY, SAVED_KEY } from '@/test/fakeApi';

const KEY = '0123456789abcdef0123456789abcdef';

describe('OwnKeyInput', () => {
  let api: ReturnType<typeof installFakeApi>;
  let wrapper: VueWrapper;

  async function mountInput() {
    const pinia = createPinia();
    setActivePinia(pinia);
    wrapper = mount(OwnKeyInput, {
      global: { plugins: [pinia, i18n, [PrimeVue, { unstyled: true }]] },
    });
    await flushPromises();
  }

  const input = () => wrapper.get('input');
  const saveButton = () => wrapper.find('button .pi-save');
  const removeButton = () => wrapper.find('button .pi-trash');

  beforeEach(() => {
    localStorage.clear();
    i18n.global.locale.value = 'en';
    api = installFakeApi();
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('asks for a key when none is saved', async () => {
    await mountInput();

    expect(wrapper.get('label').text()).toBe('TMDB key');
    expect(wrapper.get('label').attributes('for')).toBe(
      input().attributes('id'),
    );
    expect(input().attributes('disabled')).toBeUndefined();
    expect(saveButton().exists()).toBe(true);
    expect(removeButton().exists()).toBe(false);
  });

  it('sends the typed key to the main process and forgets it', async () => {
    await mountInput();

    await input().setValue(` ${KEY} `);
    await saveButton().trigger('click');
    await flushPromises();

    expect(api.credentials.save).toHaveBeenCalledWith(KEY);
    expect((input().element as HTMLInputElement).value).toBe('');
    expect(input().attributes('disabled')).toBeDefined();
    expect(input().attributes('placeholder')).toBe('A key is saved');
    expect(removeButton().exists()).toBe(true);
  });

  it('does nothing with an empty field', async () => {
    await mountInput();

    await saveButton().trigger('click');
    await flushPromises();

    expect(api.credentials.save).not.toHaveBeenCalled();
  });

  it('explains a key that was refused and keeps the text', async () => {
    api.credentials.save.mockResolvedValue(NO_KEY);
    await mountInput();

    await input().setValue('nope');
    await saveButton().trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      'This does not look like a TMDB key.',
    );
    expect((input().element as HTMLInputElement).value).toBe('nope');
  });

  it('never shows a key that is already saved', async () => {
    api.credentials.status.mockResolvedValue(SAVED_KEY);
    await mountInput();

    expect((input().element as HTMLInputElement).value).toBe('');
    expect(input().attributes('disabled')).toBeDefined();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('warns when the key could not be stored for the next launch', async () => {
    api.credentials.status.mockResolvedValue({
      ...SAVED_KEY,
      persisted: false,
      encrypted: false,
    });
    await mountInput();

    expect(wrapper.get('[role="status"]').text()).toContain(
      'kept only until the app closes',
    );
  });

  it('warns when the key is saved without encryption', async () => {
    api.credentials.status.mockResolvedValue({
      ...SAVED_KEY,
      encrypted: false,
    });
    await mountInput();

    expect(wrapper.get('[role="status"]').text()).toContain(
      'saved without encryption',
    );
  });

  it('removes the saved key', async () => {
    api.credentials.status.mockResolvedValue(SAVED_KEY);
    await mountInput();

    await removeButton().trigger('click');
    await flushPromises();

    expect(api.credentials.clear).toHaveBeenCalled();
    expect(input().attributes('disabled')).toBeUndefined();
    expect(saveButton().exists()).toBe(true);
  });
});
