import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import AccountButtons from '@/components/Account/AccountButtons.vue';
import { useDetailsStore } from '@/stores/details';
import { useSessionStore } from '@/stores/session';
import { useToastsStore } from '@/stores/toasts';
import { BREAKING_BAD, installFakeApi, SIGNED_IN } from '@/test/fakeApi';

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
      'Sign in to keep this title in your list or favorites, or to rate it',
    );
    expect(link.attributes('href')).toBe('#/account?next=/movie/603');
    expect(api.account.states).not.toHaveBeenCalled();
    expect(wrapper.find('select').exists()).toBe(false);
  });

  it('says whether the title is in each list, as toggle buttons', async () => {
    useSessionStore().state = SIGNED_IN;
    api.account.states.mockResolvedValue({
      ok: true,
      data: { watchlist: true, favorite: false, rated: null },
    });

    await mountButtons();

    expect(api.account.states).toHaveBeenCalledWith({ type: 'movie', id: 603 });
    expect(button('My list').attributes('aria-pressed')).toBe('true');
    expect(button('My list').find('.pi-bookmark-fill').exists()).toBe(true);
    expect(button('Favorite').attributes('aria-pressed')).toBe('false');
    expect(button('Favorite').find('.pi-heart').exists()).toBe(true);
  });

  it('has the rating of the title, from the same answer of TMDB', async () => {
    useSessionStore().state = SIGNED_IN;
    api.account.states.mockResolvedValue({
      ok: true,
      data: { watchlist: false, favorite: false, rated: 7.5 },
    });

    await mountButtons();

    expect(api.account.states).toHaveBeenCalledOnce();
    expect(
      (
        wrapper.get('[role="radiogroup"] input:checked')
          .element as HTMLInputElement
      ).value,
    ).toBe('7.5');
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

  it('marks the title watched at once, as a toggle', async () => {
    useSessionStore().state = SIGNED_IN;
    await mountButtons();

    expect(button('Watched').attributes('aria-pressed')).toBe('false');
    expect(api.watched.state).toHaveBeenCalledWith({ type: 'movie', id: 603 });

    await button('Watched').trigger('click');

    // On at once, with a spinner until TMDB takes it.
    expect(button('Watched').attributes('aria-pressed')).toBe('true');
    expect(button('Watched').attributes('aria-busy')).toBe('true');
    expect(api.watched.mark).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'movie', id: 603, value: true }),
    );

    await flushPromises();

    expect(button('Watched').attributes('aria-busy')).toBeUndefined();
    expect(button('Watched').find('.pi-check-circle').exists()).toBe(true);
  });

  describe('of a show', () => {
    const numbers = (count: number) =>
      Array.from({ length: count }, (_, index) => index + 1);

    async function mountShow(seasons: Record<number, number[]>, whole = false) {
      useSessionStore().state = SIGNED_IN;
      useDetailsStore().details = BREAKING_BAD;
      api.watched.state.mockResolvedValue({ ok: true, data: whole });
      api.watched.progress.mockResolvedValue({
        ok: true,
        data: [{ id: 1396, seasons, changedAt: '2026-11-19' }],
      });
      await router.replace('/tv/1396');
      wrapper = mount(AccountButtons, {
        props: { type: 'tv', id: 1396 },
        global: { plugins: [pinia, i18n, router] },
      });
      await flushPromises();
    }

    it('marks every episode out with the show', async () => {
      await mountShow({ 2: [1], 0: [3] });

      await button('Watched').trigger('click');
      await flushPromises();

      expect(api.watched.saveProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1396,
          seasons: { 0: [3], 1: numbers(7), 2: numbers(13) },
        }),
      );
      expect(api.watched.mark).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tv', id: 1396, value: true }),
      );
      expect(button('Watched').attributes('aria-pressed')).toBe('true');
    });

    it('takes every episode away with the show', async () => {
      await mountShow({ 1: numbers(7), 2: numbers(13) }, true);

      await button('Watched').trigger('click');
      await flushPromises();

      expect(api.watched.saveProgress).toHaveBeenCalledWith(
        expect.objectContaining({ seasons: {} }),
      );
      expect(api.watched.mark).toHaveBeenCalledWith(
        expect.objectContaining({ value: false }),
      );
    });

    it('goes back to the episodes watched before when undone', async () => {
      await mountShow({ 2: [1] });

      await button('Watched').trigger('click');
      await flushPromises();
      useToastsStore().toasts[0].action!.run();
      await flushPromises();

      expect(api.watched.saveProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({ seasons: { 2: [1] } }),
      );
      expect(api.watched.mark).toHaveBeenLastCalledWith(
        expect.objectContaining({ value: false }),
      );
      expect(button('Watched').attributes('aria-pressed')).toBe('false');
    });
  });

  it('tells in a notice what changed, with a way to undo it', async () => {
    useSessionStore().state = SIGNED_IN;
    await mountButtons();

    await button('My list').trigger('click');
    await flushPromises();

    const toasts = useToastsStore();
    expect(toasts.toasts.map((toast) => toast.message)).toEqual([
      'Added to My list.',
    ]);

    toasts.toasts[0].action!.run();
    await flushPromises();

    expect(api.account.mark).toHaveBeenLastCalledWith(
      expect.objectContaining({ list: 'watchlist', value: false }),
    );
    expect(button('My list').attributes('aria-pressed')).toBe('false');
    expect(toasts.toasts.at(-1)?.message).toBe('Removed from My list.');
  });

  it('asks to sign in again to mark what was watched, and leaves the rest as it is', async () => {
    useSessionStore().state = SIGNED_IN;
    api.watched.state.mockResolvedValue({
      ok: false,
      error: { code: 'sign-in-again' },
    });

    await mountButtons();

    expect(button('Watched')).toBeUndefined();
    expect(wrapper.text()).toContain('sign out and sign in with TMDB again');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(button('My list').attributes('disabled')).toBeUndefined();
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
