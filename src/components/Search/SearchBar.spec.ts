import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import i18n from '@/plugins/i18n';
import SearchBar from '@/components/Search/SearchBar.vue';
import { SEARCH_DEBOUNCE_MS, useSearchStore } from '@/stores/search';
import { installFakeApi, pageOf } from '@/test/fakeApi';

describe('SearchBar', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useSearchStore>;
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.useFakeTimers();
    i18n.global.locale.value = 'en';
    api = installFakeApi();

    const pinia = createPinia();
    setActivePinia(pinia);
    store = useSearchStore();
    wrapper = mount(SearchBar, {
      global: { plugins: [pinia, i18n, [PrimeVue, { unstyled: true }]] },
    });
  });

  afterEach(() => {
    wrapper.unmount();
    vi.useRealTimers();
    delete window.api;
  });

  it('searches once after the user stops typing', async () => {
    const input = wrapper.get('[data-pc-name="inputtext"]');

    for (const text of ['ma', 'mat', 'matr', 'matrix']) {
      await input.setValue(text);
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 50);
    }
    expect(api.tmdb.search).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

    expect(api.tmdb.search).toHaveBeenCalledTimes(1);
    expect(api.tmdb.search).toHaveBeenCalledWith({
      type: 'movie',
      query: 'matrix',
      page: 1,
      language: 'en',
    });
  });

  it('searches right away when the media type changes', async () => {
    store.query = 'matrix';
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    api.tmdb.search.mockClear();

    await wrapper.get('#mediaTypeTVShow').setValue(true);
    await nextTick();

    expect(store.mediaType).toBe('tv');
    expect(api.tmdb.search).toHaveBeenCalledTimes(1);
    expect(api.tmdb.search).toHaveBeenCalledWith({
      type: 'tv',
      query: 'matrix',
      page: 1,
      language: 'en',
    });
  });

  it('asks for the same page again when the language changes', async () => {
    store.query = 'matrix';
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    api.tmdb.search.mockResolvedValue({
      ok: true,
      data: pageOf([{ id: 603 }], { page: 3, totalResults: 60 }),
    });
    await store.search(3);
    api.tmdb.search.mockClear();

    i18n.global.locale.value = 'pt-BR';
    await nextTick();

    expect(api.tmdb.search).toHaveBeenCalledTimes(1);
    expect(api.tmdb.search).toHaveBeenCalledWith({
      type: 'movie',
      query: 'matrix',
      page: 3,
      language: 'pt-BR',
    });
  });
});
