import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import i18n from '@/plugins/i18n';
import SearchBar from '@/components/Search/SearchBar.vue';
import {
  SEARCH_DEBOUNCE_MS,
  mediaType,
  searchText,
} from '@/services/searchMediaLogic';
import { MEDIA_TYPES } from '@/util/constants';
import { theMovieDb } from '@/util/tmdb';

const emptyPage = {
  response: { page: 1, results: [], total_pages: 0, total_results: 0 },
};

describe('SearchBar', () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.useFakeTimers();
    searchText.value = '';
    mediaType.value = MEDIA_TYPES.MOVIE;
    wrapper = mount(SearchBar, {
      global: { plugins: [i18n, [PrimeVue, { unstyled: true }]] },
    });
  });

  afterEach(() => {
    wrapper.unmount();
    vi.useRealTimers();
  });

  it('searches once after the user stops typing', async () => {
    const getMovie = vi
      .spyOn(theMovieDb.search, 'getMovie')
      .mockResolvedValue(emptyPage);
    const input = wrapper.get('[data-pc-name="inputtext"]');

    for (const text of ['ma', 'mat', 'matr', 'matrix']) {
      await input.setValue(text);
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 50);
    }
    expect(getMovie).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

    expect(getMovie).toHaveBeenCalledTimes(1);
    expect(getMovie).toHaveBeenCalledWith({ query: 'matrix', page: 1 });
  });

  it('searches right away when the media type changes', async () => {
    vi.spyOn(theMovieDb.search, 'getMovie').mockResolvedValue(emptyPage);
    const getTv = vi
      .spyOn(theMovieDb.search, 'getTv')
      .mockResolvedValue(emptyPage);
    searchText.value = 'matrix';
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    getTv.mockClear();

    mediaType.value = MEDIA_TYPES.TV_SHOW;
    await nextTick();

    expect(getTv).toHaveBeenCalledTimes(1);
    expect(getTv).toHaveBeenCalledWith({ query: 'matrix', page: 1 });
  });
});
