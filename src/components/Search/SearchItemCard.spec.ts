import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import i18n from '@/plugins/i18n';
import SearchItemCard from '@/components/Search/SearchItemCard.vue';

const movie = {
  title: 'The Matrix',
  poster_path: '/matrix.jpg',
  genre_ids: [28],
  vote_average: 8.2,
  release_date: '1999-03-31',
};

describe('SearchItemCard', () => {
  it('renders title, year, rating, genres and poster', () => {
    const wrapper = mount(SearchItemCard, {
      props: { item: movie },
      global: { plugins: [i18n] },
    });

    expect(wrapper.text()).toContain('The Matrix (1999)');
    expect(wrapper.text()).toContain('8.20');
    expect(wrapper.text()).toContain('Action');

    const img = wrapper.get('img');
    expect(img.attributes('src')).toContain('/matrix.jpg');
    expect(img.attributes('alt')).toBe('The Matrix');
  });
});
