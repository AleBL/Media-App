import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { MediaItem, MediaList } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import { useSessionStore } from '@/stores/session';
import { useToastsStore } from '@/stores/toasts';
import { BREAKING_BAD, installFakeApi, SIGNED_IN } from '@/test/fakeApi';
import HomePage from '@/views/HomePage.vue';

const TITLES: Partial<Record<MediaList, MediaItem[]>> = {
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
  'trending-tv': [{ id: 1396, media_type: 'tv', name: 'Breaking Bad' }],
  'popular-movies': [{ id: 27205, media_type: 'movie', title: 'Inception' }],
  'popular-tv': [{ id: 1399, media_type: 'tv', name: 'Game of Thrones' }],
  'now-playing': [{ id: 1, media_type: 'movie', title: 'In Theaters' }],
};

const DEFAULT_TITLES = [
  'Trending this week',
  'Popular movies',
  'Popular TV shows',
  'Now playing in theaters',
  'Best rated movies',
  'Best rated TV shows',
  'Popular TV shows: Action & Adventure',
  'Popular movies: Comedy',
  'Popular movies: Animation',
];

/**
 * An IntersectionObserver of the test: every row is near the screen at
 * once, unless `near` is turned off, and then only the ones brought near.
 */
const observed = new Map<Element, IntersectionObserverCallback>();
let near = true;

class FakeObserver {
  constructor(private callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    observed.set(target, this.callback);

    if (near) {
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
  }

  unobserve(target: Element) {
    observed.delete(target);
  }

  disconnect() {}

  takeRecords() {
    return [];
  }
}

function bringNear(target: Element) {
  observed.get(target)?.(
    [{ isIntersecting: true, target } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
}

describe('HomePage', () => {
  const realObserver = globalThis.IntersectionObserver;
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
  const headings = () =>
    wrapper.findAll('section h2').map((heading) => heading.text());
  const button = (name: string) =>
    wrapper
      .findAll('button')
      .find(
        (one) => one.text() === name || one.attributes('aria-label') === name,
      )!;

  beforeEach(() => {
    near = true;
    observed.clear();
    globalThis.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;
    localStorage.clear();
    localStorage.setItem('region', 'BR');
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    api.tmdb.list.mockImplementation(async ({ list }) => ({
      ok: true,
      data: TITLES[list] ?? [],
    }));
    api.tmdb.discover.mockImplementation(async ({ type }) => ({
      ok: true,
      data: {
        page: 1,
        results: [
          type === 'movie'
            ? { id: 2, media_type: 'movie', title: 'Discovered movie' }
            : { id: 3, media_type: 'tv', name: 'Discovered show' },
        ],
        totalPages: 1,
        totalResults: 1,
      },
    }));
    api.tmdb.genres.mockResolvedValue({
      ok: true,
      data: [
        { id: 10759, name: 'Action & Adventure' },
        { id: 35, name: 'Comedy' },
        { id: 16, name: 'Animation' },
        { id: 18, name: 'Drama' },
      ],
    });
    pinia = createPinia();
    setActivePinia(pinia);
  });

  afterEach(async () => {
    globalThis.IntersectionObserver = realObserver;
    wrapper.unmount();
    delete window.api;
    // The type a test left in the address would set the next one.
    await router.replace('/home');
  });

  it('searches from its top, straight to the results', async () => {
    await mountPage();

    expect(wrapper.get('h1').text()).toBe('What do you want to watch?');

    const form = wrapper.get('form[role="search"]');
    await form.get('input[type="search"]').setValue('  matrix ');
    await form.trigger('submit');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('search');
    expect(router.currentRoute.value.query).toEqual({ q: 'matrix' });
  });

  it('has the buttons of the lists of the account on each poster, for whoever signed in', async () => {
    useSessionStore().state = SIGNED_IN;
    api.account.list.mockImplementation(async ({ list, type, page }) => ({
      ok: true,
      data: {
        page,
        results:
          list === 'watchlist' && type === 'movie'
            ? [{ id: 603, media_type: 'movie' }]
            : [],
        totalPages: 1,
        totalResults: 1,
      },
    }));

    await mountPage();

    const buttons = section('Trending this week').findAll('article button');

    expect(
      buttons.map((one) => [
        one.attributes('aria-label'),
        one.attributes('aria-pressed'),
      ]),
    ).toEqual([
      ['My list: Matrix', 'true'],
      ['Favorite: Matrix', 'false'],
      ['My list: Breaking Bad', 'false'],
      ['Favorite: Breaking Bad', 'false'],
    ]);
  });

  it('shows the rows the app starts with, each title a link to its page', async () => {
    await mountPage();

    expect(headings()).toEqual(DEFAULT_TITLES);

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
    // in the theaters of the country of the settings
    expect(api.tmdb.list).toHaveBeenCalledWith({
      list: 'now-playing',
      language: 'en',
      region: 'BR',
    });
    expect(api.tmdb.discover).toHaveBeenCalledWith({
      type: 'tv',
      language: 'en',
      region: 'BR',
      sort: 'popularity',
      genres: [10759],
      page: 1,
    });
    expect(section('Popular movies: Comedy').text()).toContain(
      'Discovered movie',
    );
  });

  it('asks for a row only once it comes near the screen', async () => {
    near = false;

    await mountPage();

    expect(api.tmdb.list).not.toHaveBeenCalled();
    expect(
      section('Popular movies: Comedy').get('[role="status"]').text(),
    ).toBe('Loading...');

    bringNear(section('Popular movies: Comedy').element);
    await flushPromises();

    expect(api.tmdb.list).not.toHaveBeenCalled();
    expect(api.tmdb.discover).toHaveBeenCalledTimes(1);
    expect(api.tmdb.discover).toHaveBeenCalledWith(
      expect.objectContaining({ genres: [35] }),
    );
    expect(section('Popular movies: Comedy').text()).toContain(
      'Discovered movie',
    );
  });

  it('leads to all the titles of a row in Explore, when it has them', async () => {
    await mountPage();

    const seeAll = (title: string) =>
      wrapper.find(`a[aria-label="See all: ${title}"]`);

    expect(
      seeAll('Popular TV shows: Action & Adventure').attributes('href'),
    ).toBe('#/discover?type=tv&genres=10759');
    expect(seeAll('Popular movies').attributes('href')).toBe('#/discover');
    expect(seeAll('Popular movies').text()).toBe('See all');
    expect(seeAll('Trending this week').exists()).toBe(false);
  });

  it('shows the movies or the tv shows alone, with what is trending of that type', async () => {
    await mountPage();

    await wrapper.get('input[name="home-kind"][value="tv"]').setValue(true);
    await flushPromises();

    expect(router.currentRoute.value.query).toEqual({ type: 'tv' });
    expect(headings()).toEqual([
      'Trending this week',
      'Popular TV shows',
      'Best rated TV shows',
      'Popular TV shows: Action & Adventure',
    ]);
    expect(api.tmdb.list).toHaveBeenCalledWith({
      list: 'trending-tv',
      language: 'en',
    });
    expect(section('Trending this week').findAll('article')).toHaveLength(1);
  });

  it('shows first the shows the user is watching, but not among the movies', async () => {
    useSessionStore().state = SIGNED_IN;
    api.tmdb.details.mockResolvedValue({ ok: true, data: BREAKING_BAD });
    api.watched.progress.mockResolvedValue({
      ok: true,
      data: [{ id: 1396, seasons: { 1: [1] }, changedAt: '2026-11-19' }],
    });

    await mountPage();

    expect(headings()[0]).toBe('Continue watching');
    expect(section('Continue watching').text()).toContain('Breaking Bad');

    await wrapper.get('input[name="home-kind"][value="movie"]').setValue(true);
    await flushPromises();

    expect(headings()).not.toContain('Continue watching');
  });

  it('shows a row made in Explore, with its filters', async () => {
    localStorage.setItem(
      'home-rows',
      JSON.stringify([
        { query: { type: 'tv', genres: '18', rating: '7', mine: '1' } },
      ]),
    );
    localStorage.setItem('my-services', JSON.stringify([119, 8]));

    await mountPage();

    expect(api.tmdb.discover).toHaveBeenCalledWith({
      type: 'tv',
      language: 'en',
      region: 'BR',
      sort: 'popularity',
      genres: [18],
      minRating: 7,
      providers: [8, 119],
      page: 1,
    });
    const row = section('Popular TV shows: Drama');
    expect(
      row
        .get('h2 + ul')
        .findAll('li')
        .map((fact) => fact.text()),
    ).toEqual(['Rating 7+', 'On my services']);
    expect(row.text()).toContain('Discovered show');
  });

  it('says a row is loading until it arrives', async () => {
    api.tmdb.list.mockReturnValue(new Promise(() => {}));

    await mountPage();

    expect(section('Popular movies').get('[role="status"]').text()).toBe(
      'Loading...',
    );
  });

  it('says when a row has no titles', async () => {
    await mountPage();
    api.tmdb.list.mockResolvedValue({ ok: true, data: [] });

    i18n.global.locale.value = 'es';
    await nextTick();
    await flushPromises();

    expect(section('Tendencias de la semana').text()).toContain(
      'Ningún título en esta fila.',
    );
  });

  it('offers to load again a row that failed, and only that one', async () => {
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

    await trending.get('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(api.tmdb.list).toHaveBeenLastCalledWith({
      list: 'trending',
      language: 'en',
    });
    expect(section('Trending this week').text()).toContain('Matrix');
  });

  it('says once, for every row, that the app has no access, and asks again when back', async () => {
    const noAccess = {
      ok: false as const,
      error: { code: 'missing-credential' as const },
    };
    api.tmdb.list.mockResolvedValue(noAccess);
    api.tmdb.discover.mockResolvedValue(noAccess);

    await mountPage();

    expect(wrapper.findAll('[role="alert"]')).toHaveLength(1);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'This copy of the app has no access to TMDB.',
    );
    expect(wrapper.get('[role="alert"] a').attributes('href')).toBe(
      '#/settings',
    );
    expect(wrapper.find('section').exists()).toBe(false);

    // back from the settings, with a key that works
    wrapper.unmount();
    api.tmdb.list.mockResolvedValue({ ok: true, data: TITLES.trending! });
    api.tmdb.discover.mockResolvedValue({
      ok: true,
      data: { page: 1, results: [], totalPages: 0, totalResults: 0 },
    });
    await mountPage();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(section('Trending this week').text()).toContain('Matrix');
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

    expect(api.tmdb.list).toHaveBeenCalledWith({
      list: 'now-playing',
      language: 'pt-BR',
      region: 'BR',
    });
    expect(api.tmdb.discover).toHaveBeenLastCalledWith(
      expect.objectContaining({ language: 'pt-BR' }),
    );
    expect(wrapper.text()).toContain('Em alta na semana');
  });

  it('moves the rows, takes them out and brings back the first ones, each undone from its notice', async () => {
    await mountPage();
    const toasts = useToastsStore();
    const rows = () =>
      wrapper.findAll('ol li').map((row) => row.get('p').text());

    await button('Customize the home page').trigger('click');

    expect(rows()).toEqual(DEFAULT_TITLES);
    expect(
      button('Move up: Trending this week').attributes('aria-disabled'),
    ).toBe('true');

    await button('Move down: Trending this week').trigger('click');
    await button('Remove: Popular TV shows').trigger('click');

    expect(rows().slice(0, 3)).toEqual([
      'Popular movies',
      'Trending this week',
      'Now playing in theaters',
    ]);
    expect(toasts.toasts.at(-1)!.message).toBe(
      'Popular TV shows left the home page.',
    );

    toasts.toasts.at(-1)!.action!.run();
    await nextTick();
    expect(rows()).toContain('Popular TV shows');

    await button('Restore the default rows').trigger('click');
    expect(rows()).toEqual(DEFAULT_TITLES);
    expect(localStorage.getItem('home-rows')).toBeNull();

    await button('Done').trigger('click');
    await flushPromises();
    expect(headings()).toEqual(DEFAULT_TITLES);
  });

  it('says how to add a row, in Explore', async () => {
    await mountPage();

    await button('Customize the home page').trigger('click');

    expect(wrapper.text()).toContain(
      'To add a row, choose its filters in Explore',
    );
    expect(
      wrapper
        .findAll('a')
        .find((link) => link.text() === 'Open Explore')!
        .attributes('href'),
    ).toBe('#/discover');
  });

  it('says when it has no rows, with a way to change them', async () => {
    localStorage.setItem('home-rows', '[]');

    await mountPage();

    expect(wrapper.text()).toContain('No rows here');
    await button('Customize the home page').trigger('click');
    expect(wrapper.text()).toContain('Restore the default rows');
  });
});
