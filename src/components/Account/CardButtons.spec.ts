import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import CardButtons from '@/components/Account/CardButtons.vue';
import { useSessionStore } from '@/stores/session';
import { installFakeApi, SIGNED_IN } from '@/test/fakeApi';

describe('CardButtons', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let wrapper: VueWrapper;

  async function mountButtons() {
    wrapper = mount(CardButtons, {
      props: { type: 'movie', id: 603, name: 'The Matrix' },
      global: { plugins: [pinia, i18n] },
    });
    await flushPromises();
  }

  const button = (name: string) =>
    wrapper
      .findAll('button')
      .find((found) => found.attributes('aria-label') === name)!;

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('shows nothing to nobody signed in', async () => {
    await mountButtons();

    expect(wrapper.find('button').exists()).toBe(false);
    expect(api.account.list).not.toHaveBeenCalled();
  });

  it('shows nothing until the app knows where the title is', async () => {
    useSessionStore().state = SIGNED_IN;
    api.account.list.mockReturnValue(new Promise(() => {}));

    await mountButtons();

    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('says whether the title is in each list, named by the title', async () => {
    useSessionStore().state = SIGNED_IN;
    api.account.list.mockImplementation(async ({ list, type, page }) => ({
      ok: true,
      data: {
        page,
        results:
          list === 'favorite' && type === 'movie'
            ? [{ id: 603, media_type: 'movie' }]
            : [],
        totalPages: 1,
        totalResults: 1,
      },
    }));

    await mountButtons();

    expect(button('My list: The Matrix').attributes('aria-pressed')).toBe(
      'false',
    );
    expect(button('Favorite: The Matrix').attributes('aria-pressed')).toBe(
      'true',
    );
    expect(button('Favorite: The Matrix').find('.pi-heart-fill').exists()).toBe(
      true,
    );
  });

  it('changes at once, and goes back, telling a screen reader, when TMDB refuses', async () => {
    useSessionStore().state = SIGNED_IN;
    let answer!: (result: Result<null>) => void;
    api.account.mark.mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );
    await mountButtons();

    await button('My list: The Matrix').trigger('click');

    expect(button('My list: The Matrix').attributes('aria-pressed')).toBe(
      'true',
    );
    expect(api.account.mark).toHaveBeenCalledWith({
      type: 'movie',
      id: 603,
      list: 'watchlist',
      value: true,
    });

    answer({ ok: false, error: { code: 'network' } });
    await flushPromises();

    expect(button('My list: The Matrix').attributes('aria-pressed')).toBe(
      'false',
    );
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'The change could not be saved. Try again.',
    );
  });

  it('is in the language of the app', async () => {
    i18n.global.locale.value = 'pt-BR';
    useSessionStore().state = SIGNED_IN;

    await mountButtons();

    expect(
      wrapper.findAll('button').map((found) => found.attributes('aria-label')),
    ).toEqual(['Minha lista: The Matrix', 'Favorito: The Matrix']);
  });
});
