import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { MediaItem, MediaList } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import { installFakeApi } from '@/test/fakeApi';
import HomePage from '@/views/HomePage.vue';

const TITLES: Record<MediaList, MediaItem[]> = {
  trending: [
    {
      id: 603,
      media_type: 'movie',
      title: 'Matrix',
      release_date: '1999-03-31',
      vote_average: 8.2,
    },
    {
      id: 1396,
      media_type: 'tv',
      name: 'Breaking Bad',
      first_air_date: '2008-01-20',
    },
  ],
  'popular-movies': [{ id: 27205, media_type: 'movie', title: 'Inception' }],
  'popular-tv': [{ id: 1399, media_type: 'tv', name: 'Game of Thrones' }],
};

describe('HomePage', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let wrapper: VueWrapper;

  async function mountPage() {
    wrapper = mount(HomePage, {
      global: { plugins: [pinia, i18n, router] },
    });
    await flushPromises();
  }

  const section = (title: string) =>
    wrapper
      .findAll('section')
      .find((found) => found.get('h2').text() === title)!;

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    api.tmdb.list.mockImplementation(async ({ list }) => ({
      ok: true,
      data: TITLES[list],
    }));
    pinia = createPinia();
    setActivePinia(pinia);
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('still leads to the search', async () => {
    await mountPage();

    expect(wrapper.get('h1').text()).toBe('Home Page');
    expect(wrapper.get('a[href="#/search"]').text()).toBe('Start searching');
  });

  it('shows the lists, each title a link to its page', async () => {
    await mountPage();

    expect(wrapper.findAll('h2').map((heading) => heading.text())).toEqual([
      'Trending this week',
      'Popular movies',
      'Popular TV shows',
    ]);

    const trending = section('Trending this week').findAll('article');

    expect(trending.map((card) => card.get('a').text())).toEqual([
      'Matrix',
      'Breaking Bad',
    ]);
    expect(trending.map((card) => card.get('a').attributes('href'))).toEqual([
      '#/movie/603',
      '#/tv/1396',
    ]);
    expect(trending[0].text()).toContain('1999');
    expect(trending[0].text()).toContain('8.2');
    expect(section('Popular TV shows').text()).toContain('Game of Thrones');
  });

  it('says a list is loading until it arrives', async () => {
    api.tmdb.list.mockReturnValue(new Promise(() => {}));

    await mountPage();

    expect(section('Popular movies').get('[role="status"]').text()).toBe(
      'Loading...',
    );
  });

  it('offers to load again a list that failed, and only that one', async () => {
    api.tmdb.list.mockImplementationOnce(async () => ({
      ok: false,
      error: { code: 'network' },
    }));

    await mountPage();

    const trending = section('Trending this week');
    expect(trending.get('[role="alert"]').text()).toContain(
      'This list could not be loaded.',
    );
    expect(section('Popular movies').text()).toContain('Inception');

    await trending.get('button').trigger('click');
    await flushPromises();

    expect(api.tmdb.list).toHaveBeenLastCalledWith({
      list: 'trending',
      language: 'en',
    });
    expect(section('Trending this week').text()).toContain('Matrix');
  });

  it('says once, for every list, that the app has no access', async () => {
    api.tmdb.list.mockResolvedValue({
      ok: false,
      error: { code: 'missing-credential' },
    });

    await mountPage();

    expect(wrapper.findAll('[role="alert"]')).toHaveLength(1);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'This copy of the app has no access to TMDB.',
    );
    expect(wrapper.get('[role="alert"] a').attributes('href')).toBe(
      '#/settings',
    );
    expect(wrapper.find('section').exists()).toBe(false);
  });

  it('tells a visitor of the web version to come back later', async () => {
    api.platform = 'web';
    api.tmdb.list.mockResolvedValue({
      ok: false,
      error: { code: 'unauthorized', status: 401 },
    });

    await mountPage();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'The lists are unavailable at the moment.',
    );
    expect(wrapper.find('[role="alert"] a').exists()).toBe(false);
  });

  it('asks again in the language chosen in the menu', async () => {
    await mountPage();

    i18n.global.locale.value = 'pt-BR';
    await nextTick();
    await flushPromises();

    expect(api.tmdb.list).toHaveBeenLastCalledWith({
      list: 'popular-tv',
      language: 'pt-BR',
    });
    expect(wrapper.text()).toContain('Em alta na semana');
  });
});
