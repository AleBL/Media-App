import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import i18n from '@/plugins/i18n';
import appRouter from '@/router';
import { useDetailsStore } from '@/stores/details';
import { useSessionStore } from '@/stores/session';
import { useToastsStore } from '@/stores/toasts';
import {
  BREAKING_BAD,
  installFakeApi,
  SEASON_ONE,
  SIGNED_IN,
} from '@/test/fakeApi';
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

  it('asks to sign in to mark the episodes, then comes back', async () => {
    await open();

    const signIn = link('Sign in to mark the episodes you watched')!;
    expect(signIn.attributes('href')).toBe('/account?next=/tv/1396/season/1');
    expect(wrapper.find('button[aria-pressed]').exists()).toBe(false);
    expect(api.watched.progress).not.toHaveBeenCalled();
  });

  describe('the episodes watched', () => {
    const button = (label: string) =>
      wrapper.get(`button[aria-label="${label}"]`);
    const saved = () => api.watched.saveProgress.mock.lastCall?.[0].seasons;

    beforeEach(() => {
      useSessionStore().state = SIGNED_IN;
      api.watched.progress.mockResolvedValue({
        ok: true,
        data: [{ id: 1396, seasons: { 1: [1] }, changedAt: '2026-11-18' }],
      });
    });

    it('shows each one watched, and how many of the season', async () => {
      await open();

      expect(
        episodes().map((episode) =>
          episode.get('button[aria-pressed]').attributes('aria-pressed'),
        ),
      ).toEqual(['true', 'false', 'false']);
      expect(button('Watched: S1 E2').text()).toBe('Watched');
      expect(wrapper.text()).toContain('1 of 3 watched');
      expect(api.watched.state).toHaveBeenCalledWith({ type: 'tv', id: 1396 });
    });

    it('marks an episode watched, and takes it back', async () => {
      await open();

      await button('Watched: S1 E2').trigger('click');
      await flushPromises();

      expect(saved()).toEqual({ 1: [1, 2] });
      expect(button('Watched: S1 E2').attributes('aria-pressed')).toBe('true');
      expect(wrapper.text()).toContain('2 of 3 watched');

      await button('Watched: S1 E1').trigger('click');
      await flushPromises();

      expect(saved()).toEqual({ 1: [2] });
    });

    it('marks the whole season, with a way back in the notice', async () => {
      await open();

      await wrapper
        .findAll('button')
        .find((one) => one.text() === 'Mark season watched')!
        .trigger('click');
      await flushPromises();

      expect(saved()).toEqual({ 1: [1, 2, 7] });
      expect(wrapper.text()).toContain('3 of 3 watched');
      expect(wrapper.text()).toContain('Unmark season');

      const [notice] = useToastsStore().toasts;
      expect(notice.message).toBe('Episodes of Season 1 marked as watched.');

      notice.action!.run();
      await flushPromises();

      expect(saved()).toEqual({ 1: [1] });
      expect(wrapper.text()).toContain('1 of 3 watched');
    });

    it('marks every episode up to one, the seasons before too', async () => {
      await open(2);

      // nothing watched in the season before: the button from the first
      expect(
        episodes().map((episode) => episode.text().includes('Up to here')),
      ).toEqual([true, true, true]);

      await button('Mark every episode up to S2 E2 as watched').trigger(
        'click',
      );
      await flushPromises();

      expect(saved()).toEqual({ 1: [1, 2, 3, 4, 5, 6, 7], 2: [1, 2] });
      expect(useToastsStore().toasts[0].message).toBe(
        'Episodes up to S2 E2 marked as watched.',
      );
    });

    it('offers "up to here" only where it changes something', async () => {
      await open();

      // E1 is watched, and there is no season before
      expect(
        episodes().map((episode) => episode.text().includes('Up to here')),
      ).toEqual([false, true, true]);
    });

    it('has nothing to mark in an episode to come', async () => {
      api.tmdb.season.mockResolvedValue({
        ok: true,
        data: {
          ...SEASON_ONE,
          episodes: [
            { number: 1, airDate: '2026-11-19' },
            { number: 2, airDate: '2026-11-26' },
          ],
        },
      });

      await open();

      expect(episodes()[0].find('button[aria-pressed]').exists()).toBe(true);
      expect(episodes()[1].find('button[aria-pressed]').exists()).toBe(false);
      expect(wrapper.text()).toContain('1 of 1 watched');
    });

    it('says when the change could not be saved, and shows what TMDB has', async () => {
      api.watched.saveProgress.mockResolvedValue({
        ok: false,
        error: { code: 'server' },
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      await open();
      await button('Watched: S1 E2').trigger('click');
      await flushPromises();

      expect(wrapper.get('[role="alert"]').text()).toBe(
        'The change could not be saved. Try again.',
      );
      expect(button('Watched: S1 E2').attributes('aria-pressed')).toBe('false');
    });

    it('offers to read them again when they could not be', async () => {
      api.watched.progress.mockResolvedValueOnce({
        ok: false,
        error: { code: 'network' },
      });

      await open();

      expect(wrapper.text()).toContain(
        'The episodes you watched could not be loaded.',
      );

      await wrapper
        .findAll('button')
        .find((one) => one.text() === 'Try again')!
        .trigger('click');
      await flushPromises();

      expect(wrapper.text()).toContain('1 of 3 watched');
    });

    it('asks to sign in again without the v4 login', async () => {
      api.watched.progress.mockResolvedValue({
        ok: false,
        error: { code: 'sign-in-again' },
      });

      await open();

      expect(wrapper.text()).toContain('sign in with TMDB again');
      expect(wrapper.find('button[aria-pressed]').exists()).toBe(false);
    });
  });
});
