import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import i18n from '@/plugins/i18n';
import SearchItemCard from '@/components/Search/SearchItemCard.vue';
import type { MediaItem } from '@/types';

const movie: MediaItem = {
  id: 603,
  title: 'The Matrix',
  poster_path: '/matrix.jpg',
  genre_ids: [28],
  vote_average: 8.2,
  release_date: '1999-03-31',
};

function mountCard(item: MediaItem) {
  return mount(SearchItemCard, {
    props: { item },
    global: { plugins: [i18n] },
  });
}

describe('SearchItemCard', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });

  it('renders title, year, rating, genres and poster', () => {
    const wrapper = mountCard(movie);

    expect(wrapper.text()).toContain('The Matrix (1999)');
    expect(wrapper.text()).toContain('8.20');
    expect(wrapper.text()).toContain('Action');

    const img = wrapper.get('img');
    expect(img.attributes('src')).toBe(
      'https://image.tmdb.org/t/p/w500/matrix.jpg',
    );
    expect(img.attributes('alt')).toBe('The Matrix');
    expect(img.attributes('loading')).toBe('lazy');
  });

  it('reads name and first air date from a tv show', () => {
    const wrapper = mountCard({
      id: 1396,
      name: 'Breaking Bad',
      first_air_date: '2008-01-20',
      genre_ids: [18],
      vote_average: 8.9,
    });

    expect(wrapper.text()).toContain('Breaking Bad (2008)');
    expect(wrapper.get('img').attributes('alt')).toBe('Breaking Bad');
  });

  it('keeps the release year for January 1st in any timezone', () => {
    // vitest.config.mts runs the tests in a timezone behind UTC, where
    // new Date('2020-01-01').getFullYear() is 2019.
    const wrapper = mountCard({ ...movie, release_date: '2020-01-01' });

    expect(wrapper.text()).toContain('The Matrix (2020)');
  });

  it('leaves the year out when there is no release date', () => {
    const wrapper = mountCard({ ...movie, release_date: '' });

    expect(wrapper.text()).toContain('The Matrix');
    expect(wrapper.text()).not.toContain('NaN');
    expect(wrapper.text()).not.toContain('(');
  });

  it('falls back to the default poster', () => {
    const wrapper = mountCard({ ...movie, poster_path: null });

    expect(wrapper.get('img').attributes('src')).toContain(
      'default_search.jpg',
    );
  });

  it('translates the genres when the language changes', async () => {
    const wrapper = mountCard(movie);
    expect(wrapper.text()).toContain('Action');

    i18n.global.locale.value = 'pt-BR';
    await nextTick();

    expect(wrapper.text()).toContain('Ação');
  });
});
