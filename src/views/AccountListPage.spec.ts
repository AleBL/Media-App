import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { MediaItem, TitleList } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import AccountListPage from '@/views/AccountListPage.vue';
import { useSessionStore } from '@/stores/session';
import { ANONYMOUS, installFakeApi, SIGNED_IN } from '@/test/fakeApi';

const movie = (id: number): MediaItem => ({
  id,
  media_type: 'movie',
  title: `Movie ${id}`,
  release_date: '2020-01-01',
});

describe('AccountListPage', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let wrapper: VueWrapper;

  const PATHS: Record<TitleList, string> = {
    watchlist: '/watchlist',
    favorite: '/favorites',
    rated: '/rated',
  };

  async function mountPage(list: TitleList = 'watchlist') {
    await router.replace(PATHS[list]);
    wrapper = mount(AccountListPage, {
      props: { list },
      global: { plugins: [pinia, i18n, router] },
    });
    await flushPromises();
  }

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    pinia = createPinia();
    setActivePinia(pinia);
    useSessionStore().state = SIGNED_IN;
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('shows the movies of the list, a page at a time', async () => {
    api.account.list.mockResolvedValue({
      ok: true,
      data: {
        page: 1,
        results: Array.from({ length: 20 }, (_, i) => movie(i + 1)),
        totalPages: 2,
        totalResults: 21,
      },
    });

    await mountPage();

    expect(wrapper.get('h1').text()).toBe('My list');
    expect(api.account.list).toHaveBeenCalledWith({
      list: 'watchlist',
      type: 'movie',
      page: 1,
      language: 'en',
    });
    expect(wrapper.findAll('article')).toHaveLength(20);
    expect(wrapper.get('article a').attributes('href')).toBe('#/movie/1');
    expect(
      wrapper.findAll('.paginator-pages button').map((page) => page.text()),
    ).toEqual(['1', '2']);

    await wrapper.findAll('.paginator-pages button')[1].trigger('click');

    expect(api.account.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it('shows the tv shows when asked', async () => {
    await mountPage('favorite');
    expect(wrapper.get('h1').text()).toBe('Favorites');

    await wrapper.get('#favorite-tv').setValue(true);
    await flushPromises();

    expect(api.account.list).toHaveBeenLastCalledWith({
      list: 'favorite',
      type: 'tv',
      page: 1,
      language: 'en',
    });
    expect(
      (wrapper.get('#favorite-tv').element as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('says when the list is empty', async () => {
    await mountPage();

    expect(wrapper.text()).toContain('Nothing here yet.');
    expect(wrapper.find('article').exists()).toBe(false);
  });

  it('shows the rated titles, each with the rating it got', async () => {
    api.account.list.mockResolvedValue({
      ok: true,
      data: {
        page: 1,
        results: [{ ...movie(1), rating: 8.5 }],
        totalPages: 1,
        totalResults: 1,
      },
    });

    await mountPage('rated');

    expect(wrapper.get('h1').text()).toBe('Rated');
    expect(api.account.list).toHaveBeenCalledWith(
      expect.objectContaining({ list: 'rated', type: 'movie' }),
    );
    expect(wrapper.get('article').text()).toContain('Your rating: 8.5');
  });

  it('says when nothing was rated', async () => {
    await mountPage('rated');

    expect(wrapper.text()).toContain('Nothing rated yet.');
  });

  it('offers to try again when the list could not be loaded', async () => {
    api.account.list.mockResolvedValueOnce({
      ok: false,
      error: { code: 'network' },
    });
    await mountPage();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Your list could not be loaded.',
    );

    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(api.account.list).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('goes to the sign in, and back here after it, when the user signs out', async () => {
    await mountPage();

    useSessionStore().state = ANONYMOUS;
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('account');
    expect(router.currentRoute.value.query.next).toBe('/watchlist');
  });
});
