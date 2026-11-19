import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { MediaDetails, MediaType } from '@shared/api';
import i18n from '@/plugins/i18n';
import appRouter from '@/router';
import { installFakeApi, MATRIX } from '@/test/fakeApi';
import DetailsPage from '@/views/DetailsPage.vue';

const BREAKING_BAD: MediaDetails = {
  type: 'tv',
  id: 1396,
  title: 'Breaking Bad',
  date: '2008-01-20',
  runtime: 47,
  seasons: 5,
  episodes: 62,
  genres: [{ id: 18, name: 'Drama' }],
  cast: [],
};

describe('DetailsPage', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let router: Router;
  let wrapper: VueWrapper;

  async function open(
    path = '/movie/603',
    type: MediaType = 'movie',
    id = 603,
  ) {
    await router.push(path);
    wrapper = mount(DetailsPage, {
      props: { type, id },
      global: { plugins: [pinia, i18n, router] },
    });
    await flushPromises();
  }

  const alert = () => wrapper.find('[role="alert"]');
  const button = (name: string) =>
    wrapper.findAll('button').find((found) => found.text() === name);

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US', 'en']);
    api = installFakeApi();
    pinia = createPinia();
    setActivePinia(pinia);
    // The routes of the app, in memory: each test starts with no history.
    router = createRouter({
      history: createMemoryHistory(),
      routes: appRouter.options.routes,
    });
  });

  afterEach(() => {
    wrapper.unmount();
    // What opened in a layer of its own, such as the trailer.
    document.body.innerHTML = '';
    delete window.api;
  });

  it('shows the title with what TMDB says about it', async () => {
    await open();

    expect(wrapper.get('h1').text()).toBe('Matrix (1999)');
    expect(wrapper.text()).toContain('The Matrix');
    expect(wrapper.text()).toContain('Welcome to the Real World.');
    expect(wrapper.text()).toContain('Released March 31, 1999');
    expect(wrapper.text()).toContain('2 h 16 min');
    expect(wrapper.text()).toContain('Action, Science Fiction');
    expect(wrapper.text()).toContain('8.2');
    expect(wrapper.text()).toContain('(26,000 votes)');
    expect(wrapper.text()).toContain(
      'A hacker learns the truth about his reality.',
    );
    expect(wrapper.get('img').attributes('src')).toBe(
      'https://image.tmdb.org/t/p/w500/matrix.jpg',
    );
  });

  it('shows a wide still of the title behind its top, as a picture only', async () => {
    api.tmdb.details.mockResolvedValue({
      ok: true,
      data: { ...MATRIX, backdropPath: '/matrix-wide.jpg' },
    });

    await open();

    const still = wrapper.get('img[src$="/w1280/matrix-wide.jpg"]');
    expect(still.attributes('alt')).toBe('');
    expect(still.element.parentElement!.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('links to IMDb, to open in the browser, in its colors', async () => {
    await open();

    const imdb = wrapper.get('a[href^="https://www.imdb.com/"]');

    expect(imdb.attributes('href')).toBe(
      'https://www.imdb.com/title/tt0133093/',
    );
    expect(imdb.text()).toBe('See on IMDb');
    expect(imdb.classes()).toEqual(
      expect.arrayContaining(['bg-imdb', 'text-black']),
    );
    expect(imdb.attributes('target')).toBe('_blank');
    expect(imdb.attributes('rel')).toBe('noopener noreferrer');
  });

  it('plays the trailer over the page, without leaving the app', async () => {
    await open();

    await button('Watch the trailer')!.trigger('click');
    await flushPromises();

    expect(
      document.body
        .querySelector('[role="dialog"] iframe')!
        .getAttribute('src'),
    ).toBe(
      'https://www.youtube-nocookie.com/embed/vKQi3bBA1y8?autoplay=1&rel=0',
    );
  });

  it('shows where to watch in the region of the user, from JustWatch', async () => {
    await open();

    expect(wrapper.text()).toContain('Where to watch in United States');
    expect(wrapper.text()).toContain('Streaming');
    expect(wrapper.get('img[alt="Netflix"]').attributes('src')).toBe(
      'https://image.tmdb.org/t/p/w92/netflix.png',
    );
    // a service without a logo goes by its name
    expect(wrapper.text()).toContain('Rent');
    expect(wrapper.text()).toContain('Apple TV');
    expect(wrapper.text()).not.toContain('Buy');
    expect(wrapper.text()).toContain('Where to watch: data from JustWatch.');
    // after the services, which lead there too
    expect(
      wrapper.findAll('a[href^="https://www.themoviedb.org/"]').at(-1)!.text(),
    ).toBe('See the links on TMDB');
  });

  it('leads from each service to the page of TMDB with the links to the title', async () => {
    await open();

    const link = MATRIX.watch!.link!;
    const netflix = wrapper.get('img[alt="Netflix"]').element.closest('a')!;
    const appleTv = wrapper
      .findAll('a')
      .find((found) => found.text() === 'Apple TV')!;

    for (const service of [netflix, appleTv.element]) {
      expect(service.getAttribute('href')).toBe(link);
      expect(service.getAttribute('target')).toBe('_blank');
      expect(service.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('shows the services without links when TMDB gives no page for them', async () => {
    api.tmdb.details.mockResolvedValue({
      ok: true,
      data: { ...MATRIX, watch: { ...MATRIX.watch!, link: undefined } },
    });

    await open();

    expect(wrapper.get('img[alt="Netflix"]').element.closest('a')).toBeNull();
    expect(wrapper.text()).toContain('Apple TV');
    expect(
      wrapper.find('a[href^="https://www.themoviedb.org/"]').exists(),
    ).toBe(false);
  });

  it('says so when nothing offers the title in the region', async () => {
    api.tmdb.details.mockResolvedValue({
      ok: true,
      data: { ...MATRIX, watch: undefined },
    });

    await open();

    expect(wrapper.text()).toContain(
      'JustWatch knows of no service, store or channel that offers it in United States.',
    );
    // the source is named all the same
    expect(wrapper.text()).toContain('Where to watch: data from JustWatch.');
  });

  it('shows the cast, with a placeholder for who has no picture', async () => {
    await open();

    const people = wrapper.findAll('[aria-labelledby="cast-title"] li');

    expect(people.map((person) => person.text())).toEqual([
      'Keanu ReevesNeo',
      'Laurence FishburneMorpheus',
    ]);
    expect(people[0].get('img').attributes('src')).toBe(
      'https://image.tmdb.org/t/p/w185/k.jpg',
    );
    expect(people[1].find('img').exists()).toBe(false);
  });

  it('shows the seasons and episodes of a tv show', async () => {
    api.tmdb.details.mockResolvedValue({ ok: true, data: BREAKING_BAD });

    await open('/tv/1396', 'tv', 1396);

    expect(api.tmdb.details).toHaveBeenCalledWith({
      type: 'tv',
      id: 1396,
      language: 'en',
      region: 'US',
    });
    expect(wrapper.text()).toContain('First aired January 20, 2008');
    expect(wrapper.text()).toContain('47 min per episode');
    expect(wrapper.text()).toContain('5 seasons');
    expect(wrapper.text()).toContain('62 episodes');
    // no trailer to play
    expect(button('Watch the trailer')).toBeUndefined();
  });

  it('asks again in the language chosen in the menu', async () => {
    await open();

    i18n.global.locale.value = 'pt-BR';
    await nextTick();
    await flushPromises();

    expect(api.tmdb.details).toHaveBeenLastCalledWith(
      expect.objectContaining({ language: 'pt-BR' }),
    );
    expect(wrapper.text()).toContain('Lançado em 31 de março de 1999');
  });

  it('says when TMDB does not have the title, with nothing to retry', async () => {
    api.tmdb.details.mockResolvedValue({
      ok: false,
      error: { code: 'not-found', status: 404 },
    });

    await open();

    expect(alert().text()).toContain('This title was not found on TMDB.');
    expect(button('Try again')).toBeUndefined();
  });

  it('offers to try again after a failure of the connection', async () => {
    api.tmdb.details.mockResolvedValueOnce({
      ok: false,
      error: { code: 'network' },
    });

    await open();
    expect(alert().text()).toContain('The title could not be loaded.');

    await button('Try again')!.trigger('click');
    await flushPromises();

    expect(api.tmdb.details).toHaveBeenCalledTimes(2);
    expect(wrapper.get('h1').text()).toBe('Matrix (1999)');
  });

  it('sends the desktop app to the settings when it has no access', async () => {
    api.tmdb.details.mockResolvedValue({
      ok: false,
      error: { code: 'missing-credential' },
    });

    await open();

    expect(alert().text()).toContain(
      'This copy of the app has no access to TMDB.',
    );
    expect(alert().get('a').attributes('href')).toBe('/settings');
  });

  it('tells a visitor of the web version to come back later', async () => {
    api.platform = 'web';
    api.tmdb.details.mockResolvedValue({
      ok: false,
      error: { code: 'unauthorized', status: 401 },
    });

    await open();

    expect(alert().text()).toContain('This page is unavailable at the moment.');
    expect(alert().find('a').exists()).toBe(false);
  });

  it('goes back to where the user came from', async () => {
    await open();
    // What the history of the browser says after coming from another page:
    // the history in memory of the tests does not keep it.
    Object.defineProperty(router.options.history, 'state', {
      value: { back: '/home' },
    });
    const back = vi.spyOn(router, 'back');

    await button('Back')!.trigger('click');

    expect(back).toHaveBeenCalled();
  });

  it('goes to the search from a page opened by its address', async () => {
    await open();

    await button('Back')!.trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('search');
  });
});
