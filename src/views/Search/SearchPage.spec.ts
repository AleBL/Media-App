import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { TMDB_PAGE_SIZE, type MediaItem } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import SearchPage from '@/views/Search/SearchPage.vue';
import { useSearchStore } from '@/stores/search';
import { installFakeApi } from '@/test/fakeApi';

function movie(id: number): MediaItem {
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
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let store: ReturnType<typeof useSearchStore>;
  let wrapper: VueWrapper;

  // The search state is prepared first and the page mounted after it, the
  // way the user finds it when coming back to the search page.
  async function mountPage() {
    wrapper = mount(SearchPage, {
      global: {
        plugins: [pinia, i18n, router, [PrimeVue, { unstyled: true }]],
      },
    });
    await flushPromises();
  }

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    api.tmdb.genres.mockResolvedValue({
      ok: true,
      data: [{ id: 28, name: 'Action' }],
    });
    pinia = createPinia();
    setActivePinia(pinia);
    store = useSearchStore();
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('shows nothing below the search bar before a search', async () => {
    await mountPage();

    expect(wrapper.text()).not.toContain('No records found');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('loads the genre names of the current language', async () => {
    i18n.global.locale.value = 'pt-BR';

    await mountPage();

    expect(api.tmdb.genres).toHaveBeenCalledWith('pt-BR');
  });

  it('shows a loading message instead of "not found" while searching', async () => {
    store.loading = true;

    await mountPage();

    expect(wrapper.get('[role="status"]').text()).toBe('Searching...');
    expect(wrapper.text()).not.toContain('No records found');
  });

  it('shows "not found" only after TMDB answered with no results', async () => {
    store.searched = true;

    await mountPage();

    expect(wrapper.text()).toContain('No records found');
  });

  it('renders one card per result, with genres, and the right page count', async () => {
    store.results = Array.from({ length: TMDB_PAGE_SIZE }, (_, i) =>
      movie(i + 1),
    );
    store.totalResults = 45;
    store.searched = true;

    await mountPage();

    expect(wrapper.findAll('img.poster')).toHaveLength(TMDB_PAGE_SIZE);
    expect(wrapper.text()).toContain('Action');
    expect(
      wrapper.findAll('[data-pc-section="pagebutton"]').map((b) => b.text()),
    ).toEqual(['1', '2', '3']);
  });

  it('asks for the page chosen in the paginator', async () => {
    store.query = 'movie';
    store.results = Array.from({ length: TMDB_PAGE_SIZE }, (_, i) =>
      movie(i + 1),
    );
    store.totalResults = 45;
    store.searched = true;
    await mountPage();

    await wrapper.findAll('[data-pc-section="pagebutton"]')[1].trigger('click');
    await flushPromises();

    expect(api.tmdb.search).toHaveBeenCalledWith({
      type: 'movie',
      query: 'movie',
      page: 2,
      language: 'en',
    });
  });

  it('hides the paginator when everything fits on one page', async () => {
    store.results = [movie(1)];
    store.totalResults = 1;
    store.searched = true;

    await mountPage();

    expect(wrapper.find('[data-pc-name="paginator"]').exists()).toBe(false);
  });

  it.each(['missing-credential', 'unauthorized'] as const)(
    'explains a %s failure and links to the home page',
    async (code) => {
      store.error = { code };

      await mountPage();

      const alert = wrapper.get('[role="alert"]');
      expect(alert.text()).toContain('The TMDB API key is missing or invalid.');
      expect(alert.get('a').attributes('href')).toBe('#/home');
    },
  );

  it('shows a generic message for other failures', async () => {
    store.error = { code: 'network' };

    await mountPage();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain('The search failed.');
    expect(alert.find('a').exists()).toBe(false);
  });
});
