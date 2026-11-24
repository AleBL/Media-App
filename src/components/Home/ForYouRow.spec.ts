import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { MediaItem, MediaType, Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import appRouter from '@/router';
import ForYouRow from '@/components/Home/ForYouRow.vue';
import { useSessionStore } from '@/stores/session';
import { installFakeApi, SIGNED_IN } from '@/test/fakeApi';

describe('ForYouRow', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let router: Router;
  let wrapper: VueWrapper;

  async function mountRow(kind: MediaType | 'all' = 'all') {
    wrapper = mount(ForYouRow, {
      props: { kind },
      global: { plugins: [pinia, i18n, router] },
    });
    await flushPromises();
  }

  const titles = () => wrapper.findAll('li').map((item) => item.text());

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    api.account.recommendations.mockImplementation(async ({ type }) => ({
      ok: true,
      data:
        type === 'movie'
          ? [{ id: 603, media_type: 'movie', title: 'The Matrix' }]
          : [{ id: 1396, media_type: 'tv', name: 'Breaking Bad' }],
    }));
    pinia = createPinia();
    setActivePinia(pinia);
    router = createRouter({
      history: createMemoryHistory(),
      routes: appRouter.options.routes,
    });
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('shows nothing, and asks nothing, for nobody signed in', async () => {
    await mountRow();

    expect(wrapper.find('section').exists()).toBe(false);
    expect(api.account.recommendations).not.toHaveBeenCalled();
  });

  it('shows what TMDB recommends to the account, saying it is from TMDB', async () => {
    useSessionStore().state = SIGNED_IN;

    await mountRow();

    expect(wrapper.get('h2').text()).toBe('For you');
    expect(wrapper.get('h2 + p').text()).toBe(
      'Recommended by TMDB for your account',
    );
    expect(titles()).toEqual([
      expect.stringContaining('The Matrix'),
      expect.stringContaining('Breaking Bad'),
    ]);
  });

  it('shows the titles of the kind chosen', async () => {
    useSessionStore().state = SIGNED_IN;

    await mountRow('tv');

    expect(titles()).toEqual([expect.stringContaining('Breaking Bad')]);
  });

  it.each<[string, Result<MediaItem[]>]>([
    ['nothing is recommended', { ok: true, data: [] }],
    [
      'the account was signed in with a key of the user',
      { ok: false, error: { code: 'sign-in-again' } },
    ],
  ])('shows nothing when %s', async (_case, answer) => {
    api.account.recommendations.mockResolvedValue(answer);
    useSessionStore().state = SIGNED_IN;

    await mountRow();

    expect(wrapper.find('section').exists()).toBe(false);
  });

  it('says when they could not be loaded, and tries again', async () => {
    api.account.recommendations.mockResolvedValueOnce({
      ok: false,
      error: { code: 'server' },
    });
    useSessionStore().state = SIGNED_IN;

    await mountRow();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Your recommendations could not be loaded.',
    );

    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(titles()).toHaveLength(2);
  });
});
