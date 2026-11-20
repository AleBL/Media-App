import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import i18n from '@/plugins/i18n';
import router from '@/router';
import { useSessionStore } from '@/stores/session';
import { BREAKING_BAD, installFakeApi, SIGNED_IN } from '@/test/fakeApi';
import WatchedPage from '@/views/WatchedPage.vue';

describe('WatchedPage', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let wrapper: VueWrapper;

  async function mountPage() {
    await router.replace('/watched');
    wrapper = mount(WatchedPage, {
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

  it('shows the watched movies and tv shows together, each with its day', async () => {
    api.watched.list.mockResolvedValue({
      ok: true,
      data: {
        page: 1,
        results: [
          {
            id: 603,
            media_type: 'movie',
            title: 'The Matrix',
            watchedAt: '2026-11-16',
          },
          // the same id, a tv show
          { id: 603, media_type: 'tv', name: 'Some Show' },
        ],
        totalPages: 1,
        totalResults: 2,
      },
    });

    await mountPage();

    expect(wrapper.get('h1').text()).toBe('Watched');
    expect(api.watched.list).toHaveBeenCalledWith({ page: 1, language: 'en' });

    const cards = wrapper.findAll('article');
    expect(cards).toHaveLength(2);
    expect(cards[0].text()).toContain('Movie');
    expect(cards[0].text()).toContain('Watched on Nov 16, 2026');
    expect(cards[1].text()).toContain('TV Show');
    expect(cards[1].get('a').attributes('href')).toBe('#/tv/603');
  });

  it('shows the shows in progress first, then what was watched in full', async () => {
    api.tmdb.details.mockResolvedValue({ ok: true, data: BREAKING_BAD });
    api.watched.progress.mockResolvedValue({
      ok: true,
      data: [{ id: 1396, seasons: { 1: [1] }, changedAt: '2026-11-19' }],
    });
    api.watched.list.mockResolvedValue({
      ok: true,
      data: {
        page: 1,
        results: [{ id: 603, media_type: 'movie', title: 'The Matrix' }],
        totalPages: 1,
        totalResults: 1,
      },
    });

    await mountPage();

    expect(wrapper.findAll('h2').map((heading) => heading.text())).toEqual([
      'In progress',
      'Finished',
    ]);
    const inProgress = wrapper.get(
      'section[aria-labelledby="in-progress-title"]',
    );
    expect(inProgress.text()).toContain('Breaking Bad');
    expect(inProgress.text()).toContain("S1 E2 · Cat's in the Bag...");
    expect(wrapper.findAll('article')).toHaveLength(1);
  });

  it('shows the shows in progress alone, without saying nothing was watched', async () => {
    api.tmdb.details.mockResolvedValue({ ok: true, data: BREAKING_BAD });
    api.watched.progress.mockResolvedValue({
      ok: true,
      data: [{ id: 1396, seasons: { 1: [1] }, changedAt: '2026-11-19' }],
    });

    await mountPage();

    expect(wrapper.text()).toContain('In progress');
    expect(wrapper.text()).not.toContain('Nothing watched yet.');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('says when nothing was watched yet', async () => {
    await mountPage();

    expect(wrapper.text()).toContain('Nothing watched yet.');
  });

  it('offers to try again when the list could not be loaded', async () => {
    api.watched.list.mockResolvedValueOnce({
      ok: false,
      error: { code: 'network' },
    });

    await mountPage();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Your list could not be loaded.',
    );

    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(api.watched.list).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('asks to sign in again without the access token of the user', async () => {
    api.watched.list.mockResolvedValue({
      ok: false,
      error: { code: 'sign-in-again' },
    });

    await mountPage();

    expect(wrapper.text()).toContain('sign out and sign in with TMDB again');
    expect(wrapper.get('a[href="#/account"]').text()).toBe('Account');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
