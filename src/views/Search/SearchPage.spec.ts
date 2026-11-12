import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import i18n from '@/plugins/i18n';
import router from '@/router';
import SearchPage from '@/views/Search/SearchPage.vue';
import {
  PAGE_SIZE,
  currentPage,
  loading,
  mediaType,
  results,
  searchError,
  searchText,
  searched,
  totalResults,
} from '@/services/searchMediaLogic';
import { MEDIA_TYPES } from '@/util/constants';

function movie(id: number) {
  return {
    id,
    title: `Movie ${id}`,
    poster_path: `/poster-${id}.jpg`,
    genre_ids: [28],
    vote_average: 7,
    release_date: '2020-01-01',
  };
}

describe('SearchPage', () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    searchText.value = '';
    mediaType.value = MEDIA_TYPES.MOVIE;
    results.value = [];
    totalResults.value = 0;
    currentPage.value = 1;
    loading.value = false;
    searched.value = false;
    searchError.value = null;
    wrapper = mount(SearchPage, {
      global: { plugins: [i18n, router, [PrimeVue, { unstyled: true }]] },
    });
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it('shows nothing below the search bar before a search', () => {
    expect(wrapper.text()).not.toContain('No records found');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('shows a loading message instead of "not found" while searching', async () => {
    loading.value = true;
    await nextTick();

    expect(wrapper.get('[role="status"]').text()).toBe('Searching...');
    expect(wrapper.text()).not.toContain('No records found');
  });

  it('shows "not found" only after the API answered with no results', async () => {
    searched.value = true;
    await nextTick();

    expect(wrapper.text()).toContain('No records found');
  });

  it('renders one card per result and a paginator with the right page count', async () => {
    results.value = Array.from({ length: PAGE_SIZE }, (_, i) => movie(i + 1));
    totalResults.value = 45;
    searched.value = true;
    await nextTick();

    expect(wrapper.findAll('img.poster')).toHaveLength(PAGE_SIZE);
    expect(
      wrapper.findAll('[data-pc-section="pagebutton"]').map((b) => b.text())
    ).toEqual(['1', '2', '3']);
  });

  it('hides the paginator when everything fits on one page', async () => {
    results.value = [movie(1)];
    totalResults.value = 1;
    searched.value = true;
    await nextTick();

    expect(wrapper.find('[data-pc-name="paginator"]').exists()).toBe(false);
  });

  it('explains a rejected API key and links to the home page', async () => {
    searchError.value = { status: 401, message: 'Invalid API key' };
    await nextTick();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain('The TMDB API key is missing or invalid.');
    expect(alert.get('a').attributes('href')).toBe('#/home');
  });

  it('shows a generic message for other failures', async () => {
    searchError.value = { status: 0 };
    await nextTick();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain('The search failed.');
    expect(alert.find('a').exists()).toBe(false);
  });
});
