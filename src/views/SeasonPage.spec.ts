import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import i18n from '@/plugins/i18n';
import appRouter from '@/router';
import { useDetailsStore } from '@/stores/details';
import { BREAKING_BAD, installFakeApi, SEASON_ONE } from '@/test/fakeApi';
import SeasonPage from '@/views/SeasonPage.vue';

describe('SeasonPage', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let router: Router;
  let wrapper: VueWrapper;

  async function open(season = 1, from?: string) {
    if (from) {
      await router.push(from);
    }

    await router.push(`/tv/1396/season/${season}`);
    wrapper = mount(SeasonPage, {
      props: { id: 1396, season },
      global: { plugins: [pinia, i18n, router] },
    });
    await flushPromises();
  }

  const episodes = () => wrapper.findAll('ol > li');
  const link = (name: string) =>
    wrapper.findAll('a').find((one) => one.text() === name);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 19, 12));
    localStorage.clear();
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    api.tmdb.details.mockResolvedValue({ ok: true, data: BREAKING_BAD });
    pinia = createPinia();
    setActivePinia(pinia);
    router = createRouter({
      history: createMemoryHistory(),
      routes: appRouter.options.routes,
    });
  });

  afterEach(() => {
    wrapper.unmount();
    vi.useRealTimers();
    delete window.api;
  });

  it('shows the season of its show, with each episode', async () => {
    await open();

    expect(api.tmdb.season).toHaveBeenCalledWith({
      id: 1396,
      season: 1,
      language: 'en',
    });
    expect(wrapper.get('h1').text()).toBe('Season 1');
    expect(link('Breaking Bad')!.attributes('href')).toBe('/tv/1396');
    expect(wrapper.text()).toContain('2008 · 3 episodes');
    expect(wrapper.text()).toContain(
      'High school chemistry teacher Walter White learns he is ill.',
    );
    expect(episodes().map((episode) => episode.get('h3').text())).toEqual([
      'S1 E1 · Pilot',
      "S1 E2 · Cat's in the Bag...",
      'S1 E7 · A No-Rough-Stuff-Type Deal',
    ]);
    const pilot = episodes()[0].text();
    expect(pilot).toContain('January 20, 2008');
    expect(pilot).toContain('59 min');
    expect(pilot).toContain('8.3');
    expect(wrapper.get('ol img').attributes('src')).toBe(
      'https://image.tmdb.org/t/p/w300/e1.jpg',
    );
    expect(episodes()[2].text()).toContain('Season finale');
  });

  it('says a synopsis is in English when TMDB has none in the language', async () => {
    i18n.global.locale.value = 'pt-BR';

    await open();

    const second = episodes()[1];
    expect(second.get('[lang="en"]').text()).toBe('Walt and Jesse clean up.');
    expect(second.text()).toContain('O TMDB só tem esta sinopse em inglês.');
    expect(episodes()[0].find('[lang]').exists()).toBe(false);
    expect(episodes()[0].get('h3').text()).toBe('T1 E1 · Pilot');
  });

  it('names an episode without a name by its number, and says when one will air', async () => {
    api.tmdb.season.mockResolvedValue({
      ok: true,
      data: {
        ...SEASON_ONE,
        episodes: [{ number: 4, airDate: '2027-01-15' }],
      },
    });

    await open();

    expect(episodes()[0].get('h3').text()).toBe('S1 E4 · Episode 4');
    expect(episodes()[0].text()).toContain('Airs January 15, 2027');
  });

  it('leads to the season before and after, the specials last, and to any other', async () => {
    await open(2);

    expect(link('Previous season')!.attributes('href')).toBe(
      '/tv/1396/season/1',
    );
    expect(link('Next season')!.attributes('href')).toBe('/tv/1396/season/0');
    const choice = wrapper.get('select');
    expect(choice.findAll('option').map((option) => option.text())).toEqual([
      'Season 1',
      'Season 2',
      'Specials',
    ]);
    expect((choice.element as HTMLSelectElement).value).toBe('2');

    await choice.setValue('0');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/tv/1396/season/0');
  });

  it('asks for its show only when it is not there yet', async () => {
    useDetailsStore().details = BREAKING_BAD;

    await open();

    expect(api.tmdb.details).not.toHaveBeenCalled();
    expect(link('Breaking Bad')).toBeDefined();
  });

  it('asks again in the language chosen in the menu', async () => {
    await open();

    i18n.global.locale.value = 'es';
    await nextTick();
    await flushPromises();

    expect(api.tmdb.season).toHaveBeenLastCalledWith({
      id: 1396,
      season: 1,
      language: 'es',
    });
    expect(api.tmdb.details).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 1396, language: 'es' }),
    );
    expect(wrapper.get('h2').text()).toBe('Episodios');
  });

  it('says when TMDB does not have the season, leading to the show', async () => {
    api.tmdb.season.mockResolvedValue({
      ok: false,
      error: { code: 'not-found', status: 404 },
    });

    await open(9);

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'This season was not found on TMDB.',
    );
    expect(link('Go to the show')!.attributes('href')).toBe('/tv/1396');
  });

  it('offers to try again after a failure of the connection', async () => {
    api.tmdb.season.mockResolvedValueOnce({
      ok: false,
      error: { code: 'network' },
    });

    await open();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Try again')!
      .trigger('click');
    await flushPromises();

    expect(wrapper.get('h1').text()).toBe('Season 1');
  });

  it('goes back to where the user came from, or else to the show', async () => {
    await open(1, '/tv/1396');

    const back = wrapper.get('button[aria-label="Back to Breaking Bad"]');
    expect(back.text()).toBe('Breaking Bad');
    await back.trigger('click');
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe('/tv/1396'),
    );
  });
});
