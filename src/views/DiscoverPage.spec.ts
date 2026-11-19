import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { MediaItem, Paged } from '@shared/api';
import i18n from '@/plugins/i18n';
import appRouter from '@/router';
import { useToastsStore } from '@/stores/toasts';
import { installFakeApi } from '@/test/fakeApi';
import DiscoverPage from '@/views/DiscoverPage.vue';

const titles = (count: number, totalResults = 45): Paged<MediaItem> => ({
  page: 1,
  results: Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    media_type: 'movie',
    title: `Movie ${index + 1}`,
    release_date: '2020-01-01',
  })),
  totalPages: Math.ceil(totalResults / 20),
  totalResults,
});

describe('DiscoverPage', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let router: Router;
  let wrapper: VueWrapper;

  async function open(query = '') {
    await router.push(`/discover${query}`);
    wrapper = mount(DiscoverPage, {
      global: { plugins: [pinia, i18n, router] },
    });
    await flushPromises();
  }

  // The panel beside the titles; the drawer only opens on a narrow screen.
  const panel = () => wrapper.get('aside');
  const chip = (name: string) =>
    panel()
      .findAll('label')
      .find((label) => label.text() === name)!
      .get('input');
  const radio = (name: string, value: string) =>
    wrapper.get(`input[name="${name}"][value="${value}"]`);
  const button = (name: string) =>
    wrapper.findAll('button').find((one) => one.text() === name)!;
  const query = () => router.currentRoute.value.query;
  const lastDiscovery = () => api.tmdb.discover.mock.lastCall![0];

  async function choose(input: ReturnType<typeof radio>, value = true) {
    await input.setValue(value);
    await flushPromises();
  }

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('region', 'BR');
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    api.tmdb.discover.mockResolvedValue({ ok: true, data: titles(20) });
    pinia = createPinia();
    setActivePinia(pinia);
    router = createRouter({
      history: createMemoryHistory(),
      routes: appRouter.options.routes,
    });
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
    delete window.api;
  });

  it('shows the popular movies, with what the filters offer in the country', async () => {
    await open();

    expect(wrapper.get('h1').text()).toBe('Explore');
    expect(api.tmdb.discover).toHaveBeenCalledWith({
      type: 'movie',
      language: 'en',
      region: 'BR',
      sort: 'popularity',
      page: 1,
    });
    expect(api.tmdb.discoverFilters).toHaveBeenCalledWith({
      type: 'movie',
      language: 'en',
      region: 'BR',
    });
    expect(wrapper.findAll('article')).toHaveLength(20);
    expect(wrapper.text()).toContain('45 titles');
    expect(panel().text()).toContain('Action');
    expect(panel().text()).toContain('As rated in Brazil.');
  });

  it('filters by all the genres marked, kept in the address', async () => {
    await open();

    await choose(chip('Drama'));
    await choose(chip('Action'));

    expect(query()).toEqual({ genres: '18,28' });
    expect(lastDiscovery()).toMatchObject({ genres: [18, 28] });
    expect(panel().text()).toContain('Titles with all the genres marked.');

    await choose(chip('Drama'), false);

    expect(query()).toEqual({ genres: '28' });
  });

  it('shows tv shows, with their own genres', async () => {
    await open('?genres=28');

    await choose(radio('discover-type', 'tv'));

    expect(query()).toEqual({ type: 'tv' });
    expect(lastDiscovery()).toEqual({
      type: 'tv',
      language: 'en',
      region: 'BR',
      sort: 'popularity',
      page: 1,
    });
    expect(panel().text()).toContain('Action & Adventure');
  });

  it('orders by rating, among titles with enough votes', async () => {
    await open();

    await choose(radio('discover-sort', 'rating'));
    await choose(radio('panel-rating-choice', '7'));

    expect(query()).toEqual({ sort: 'rating', rating: '7' });
    expect(lastDiscovery()).toMatchObject({ sort: 'rating', minRating: 7 });
    expect(panel().text()).toContain('Only titles with at least 300 votes');
  });

  it('takes a decade, or the years typed in, in order', async () => {
    await open();
    const decade = () =>
      panel()
        .findAll('button')
        .find((one) => one.text() === '1990s')!;

    await decade().trigger('click');
    await flushPromises();

    expect(query()).toEqual({ from: '1990', to: '1999' });
    expect(decade().attributes('aria-pressed')).toBe('true');

    const from = wrapper.get('#panel-from');
    await from.setValue('2005');
    await from.trigger('change');
    await flushPromises();

    // the wrong way round
    expect(query()).toEqual({ from: '1999', to: '2005' });
    expect(lastDiscovery()).toMatchObject({ fromYear: 1999, toYear: 2005 });

    await from.setValue('1492');
    await from.trigger('change');

    expect((from.element as HTMLInputElement).value).toBe('1999');
  });

  it('takes an age rating of the country and the milder ones', async () => {
    await open();

    await choose(radio('panel-age-choice', '14'));

    expect(query()).toEqual({ age: '14' });
    expect(lastDiscovery()).toMatchObject({ ageRating: '14' });

    const badge = (code: string) =>
      radio('panel-age-choice', code).element.nextElementSibling!.className;
    expect(badge('12')).toContain('bg-classind-12');
    expect(badge('14')).toContain('bg-classind-14');
    expect(badge('16')).not.toContain('bg-classind-16');
    expect(radio('panel-age-choice', '14').attributes('aria-label')).toBe(
      '14: Not recommended for anyone under 14',
    );
  });

  it('opens with the filters of its address, as when coming back to it', async () => {
    await open(
      '?type=tv&sort=newest&genres=18&from=2010&to=2019&rating=8&original=ko&age=12',
    );

    expect(api.tmdb.discover).toHaveBeenCalledTimes(1);
    expect(lastDiscovery()).toEqual({
      type: 'tv',
      language: 'en',
      region: 'BR',
      sort: 'newest',
      genres: [18],
      fromYear: 2010,
      toYear: 2019,
      minRating: 8,
      originalLanguage: 'ko',
      ageRating: '12',
      page: 1,
    });
    expect((chip('Drama').element as HTMLInputElement).checked).toBe(true);
    expect(
      (wrapper.get('#panel-language').element as HTMLInputElement).value,
    ).toBe('Korean');
    expect(panel().get('h2').text()).toBe('Filters (5)');
  });

  it('leaves out what the filters do not offer, such as a rating of another country', async () => {
    await open('?age=PG-13&genres=10759');

    expect(lastDiscovery()).toEqual({
      type: 'movie',
      language: 'en',
      region: 'BR',
      sort: 'popularity',
      page: 1,
    });
    expect(panel().get('h2').text()).toBe('Filters');
  });

  it('keeps the services of the user and shows only what is on them', async () => {
    await open();

    await button('Choose my services').trigger('click');
    await choose(chip('Netflix'));
    await choose(chip('Amazon Prime Video'));
    await button('Done').trigger('click');
    await flushPromises();

    // chosen the first time: to see what is on them
    expect(query()).toEqual({ mine: '1' });
    expect(lastDiscovery()).toMatchObject({ providers: [8, 119] });
    expect(JSON.parse(localStorage.getItem('my-services')!)).toEqual([8, 119]);
    const toggle = wrapper.get('input[role="switch"]');
    expect((toggle.element as HTMLInputElement).checked).toBe(true);
    expect(
      wrapper.findAll('aside img').map((logo) => logo.attributes('alt')),
    ).toEqual(['Netflix', 'Amazon Prime Video']);

    await choose(toggle, false);

    expect(query()).toEqual({});
    expect(lastDiscovery()).not.toHaveProperty('providers');
  });

  it('counts the filters in use and clears them, keeping the type and the order', async () => {
    await open('?type=tv&sort=rating&genres=18&rating=7');

    expect(panel().get('h2').text()).toBe('Filters (2)');

    await button('Clear').trigger('click');
    await flushPromises();

    expect(query()).toEqual({ type: 'tv', sort: 'rating' });
  });

  it('says when no title has the filters, with a way to clear them', async () => {
    api.tmdb.discover.mockResolvedValue({ ok: true, data: titles(0, 0) });

    await open('?genres=18');

    expect(wrapper.text()).toContain('No titles with these filters');
    await button('Clear the filters').trigger('click');
    await flushPromises();

    expect(query()).toEqual({});
  });

  it('says when the titles could not be loaded, and tries again', async () => {
    api.tmdb.discover.mockResolvedValueOnce({
      ok: false,
      error: { code: 'network' },
    });

    await open();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'The titles could not be loaded.',
    );
    await button('Try again').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('article')).toHaveLength(20);
  });

  it('says when the filters could not be loaded, and tries again', async () => {
    api.tmdb.discoverFilters.mockResolvedValueOnce({
      ok: false,
      error: { code: 'network' },
    });

    await open();

    expect(panel().text()).toContain('The filters could not be loaded.');
    await panel()
      .findAll('button')
      .find((one) => one.text() === 'Try again')!
      .trigger('click');
    await flushPromises();

    expect(panel().text()).toContain('Action');
  });

  it('asks again in the language chosen in the menu', async () => {
    await open();

    i18n.global.locale.value = 'es';
    await nextTick();
    await flushPromises();

    expect(lastDiscovery()).toMatchObject({ language: 'es' });
    expect(api.tmdb.discoverFilters).toHaveBeenLastCalledWith({
      type: 'movie',
      language: 'es',
      region: 'BR',
    });
    expect(wrapper.get('h1').text()).toBe('Explorar');
  });

  it('brings the next titles at the end', async () => {
    await open();

    await button('Show more').trigger('click');
    await flushPromises();

    expect(lastDiscovery()).toMatchObject({ page: 2 });
  });

  it('puts its filters on the home page as a row, which the notice can undo', async () => {
    await open('?type=tv&genres=18&mine=1');
    const toggle = () =>
      wrapper
        .findAll('button')
        .find((one) => one.text() === 'On the home page')!;

    expect(toggle().attributes('aria-pressed')).toBe('false');

    await toggle().trigger('click');

    expect(toggle().attributes('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem('home-rows')!)[0]).toEqual({
      query: { type: 'tv', genres: '18', mine: '1' },
    });
    const toasts = useToastsStore();
    expect(toasts.toasts.at(-1)!.message).toBe('Row added to the home page.');

    toasts.toasts.at(-1)!.action!.run();
    await nextTick();

    expect(toggle().attributes('aria-pressed')).toBe('false');
    expect(localStorage.getItem('home-rows')).toBeNull();
  });

  it('knows the filters the home page has as one of its lists', async () => {
    await open('?type=tv');

    expect(
      wrapper
        .findAll('button')
        .find((one) => one.text() === 'On the home page')!
        .attributes('aria-pressed'),
    ).toBe('true');
  });
});
