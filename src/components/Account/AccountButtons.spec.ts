import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import AccountButtons from '@/components/Account/AccountButtons.vue';
import { useSessionStore } from '@/stores/session';
import { installFakeApi, SIGNED_IN } from '@/test/fakeApi';

describe('AccountButtons', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let wrapper: VueWrapper;

  async function mountButtons() {
    await router.replace('/movie/603');
    wrapper = mount(AccountButtons, {
      props: { type: 'movie', id: 603 },
      global: { plugins: [pinia, i18n, router] },
    });
    await flushPromises();
  }

  const button = (name: string) =>
    wrapper.findAll('button').find((found) => found.text() === name)!;

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

  it('offers to sign in to nobody signed in, coming back to this page', async () => {
    await mountButtons();

    const link = wrapper.get('a');
    expect(link.text()).toBe(
      'Sign in to keep this title in your list or favorites',
    );
    expect(link.attributes('href')).toBe('#/account?next=/movie/603');
    expect(api.account.states).not.toHaveBeenCalled();
  });

  it('says whether the title is in each list, as toggle buttons', async () => {
    useSessionStore().state = SIGNED_IN;
    api.account.states.mockResolvedValue({
      ok: true,
      data: { watchlist: true, favorite: false },
    });

    await mountButtons();

    expect(api.account.states).toHaveBeenCalledWith({ type: 'movie', id: 603 });
    expect(button('My list').attributes('aria-pressed')).toBe('true');
    expect(button('My list').find('.pi-bookmark-fill').exists()).toBe(true);
    expect(button('Favorite').attributes('aria-pressed')).toBe('false');
    expect(button('Favorite').find('.pi-heart').exists()).toBe(true);
  });

  it('waits for TMDB before letting the user change anything', async () => {
    useSessionStore().state = SIGNED_IN;
    api.account.states.mockReturnValue(new Promise(() => {}));
    // nor have the lists been read
    api.account.list.mockReturnValue(new Promise(() => {}));

    await mountButtons();

    expect(button('My list').attributes('disabled')).toBeDefined();
    expect(button('My list').attributes('aria-pressed')).toBeUndefined();
  });

  it('changes at once, and goes back with a message when TMDB refuses', async () => {
    useSessionStore().state = SIGNED_IN;
    let answer!: (result: Result<null>) => void;
    api.account.mark.mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );
    await mountButtons();

    await button('Favorite').trigger('click');

    expect(button('Favorite').attributes('aria-pressed')).toBe('true');
    expect(api.account.mark).toHaveBeenCalledWith({
      type: 'movie',
      id: 603,
      list: 'favorite',
      value: true,
    });

    answer({ ok: false, error: { code: 'network' } });
    await flushPromises();

    expect(button('Favorite').attributes('aria-pressed')).toBe('false');
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'The change could not be saved. Try again.',
    );
  });

  it('says when it could not learn where the title is', async () => {
    useSessionStore().state = SIGNED_IN;
    api.account.states.mockResolvedValue({
      ok: false,
      error: { code: 'network' },
    });

    await mountButtons();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Your lists could not be checked for this title.',
    );
  });
});
