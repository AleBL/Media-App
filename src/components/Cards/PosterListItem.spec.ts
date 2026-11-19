import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { MediaItem } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import PosterListItem from '@/components/Cards/PosterListItem.vue';
import { useSessionStore } from '@/stores/session';
import { installFakeApi, SIGNED_IN } from '@/test/fakeApi';

const BREAKING_BAD: MediaItem = {
  id: 1396,
  media_type: 'tv',
  name: 'Breaking Bad',
  first_air_date: '2008-01-20',
  vote_average: 8.9,
};

describe('PosterListItem', () => {
  let pinia: Pinia;
  let wrapper: VueWrapper;

  async function mountItem(item: MediaItem, showType = false) {
    wrapper = mount(PosterListItem, {
      props: { item, showType },
      global: { plugins: [pinia, i18n, router] },
    });
    await flushPromises();
  }

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    installFakeApi();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('is a line with the name, the year and the rating, its name the link', async () => {
    await mountItem(BREAKING_BAD);

    expect(wrapper.get('h3').text()).toBe('Breaking Bad (2008)');
    expect(wrapper.get('h3 a').attributes('href')).toBe('#/tv/1396');
    expect(wrapper.text()).toContain('8.9');
    // no synopsis to show, and nothing in its place
    expect(wrapper.findAll('p.line-clamp-2')).toHaveLength(0);
  });

  it('says what it is among results of both kinds', async () => {
    await mountItem(BREAKING_BAD, true);

    expect(wrapper.text()).toContain('TV Show');
  });

  it('shows the rating of the user and when it was watched, in the lists that have them', async () => {
    await mountItem({ ...BREAKING_BAD, rating: 9, watchedAt: '2026-11-16' });

    expect(wrapper.text()).toContain('Your rating: 9.0');
    expect(wrapper.text()).toContain('Nov 16, 2026');
  });

  it('has the buttons of the lists for whoever signed in', async () => {
    useSessionStore().state = SIGNED_IN;

    await mountItem(BREAKING_BAD);

    expect(
      wrapper
        .findAll('button')
        .map((button) => button.attributes('aria-label')),
    ).toEqual(['My list: Breaking Bad', 'Favorite: Breaking Bad']);
  });
});
