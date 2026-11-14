import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { TMDB_PAGE_SIZE, type MediaItem } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import SearchPage from '@/views/Search/SearchPage.vue';
import { useCredentialsStore } from '@/stores/credentials';
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

  describe('when TMDB cannot be reached with the current credential', () => {
    // The state a failed search leaves behind, with TMDB still refusing.
    function failedSearch(code: 'missing-credential' | 'unauthorized') {
      store.query = 'matrix';
      store.error = { code };
      api.tmdb.search.mockResolvedValue({ ok: false, error: { code } });
    }

    it('explains an app built without access and links to the settings', async () => {
      failedSearch('missing-credential');

      await mountPage();

      const alert = wrapper.get('[role="alert"]');
      expect(alert.text()).toContain(
        'This copy of the app has no access to TMDB.',
      );
      expect(alert.get('a').attributes('href')).toBe('#/settings');
    });

    it('blames the credential of the app when the user saved no key', async () => {
      failedSearch('unauthorized');

      await mountPage();

      const alert = wrapper.get('[role="alert"]');
      expect(alert.text()).toContain("TMDB refused the app's access.");
      expect(alert.get('a').attributes('href')).toBe('#/settings');
    });

    it('blames the key of the user when one is saved', async () => {
      failedSearch('unauthorized');
      useCredentialsStore().hasKey = true;

      await mountPage();

      const alert = wrapper.get('[role="alert"]');
      expect(alert.text()).toContain('TMDB refused your key.');
      expect(alert.get('a').attributes('href')).toBe('#/settings');
    });

    it('searches again when the user comes back, as the credential may have changed', async () => {
      failedSearch('unauthorized');
      api.tmdb.search.mockResolvedValue({
        ok: true,
        data: { page: 1, results: [movie(1)], totalPages: 1, totalResults: 1 },
      });

      await mountPage();

      expect(api.tmdb.search).toHaveBeenCalledWith({
        type: 'movie',
        query: 'matrix',
        page: 1,
        language: 'en',
      });
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.findAll('img.poster')).toHaveLength(1);
    });
  });

  it('shows a generic message for other failures, without searching again', async () => {
    store.query = 'matrix';
    store.error = { code: 'network' };

    await mountPage();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain('The search failed.');
    expect(alert.find('a').exists()).toBe(false);
    expect(api.tmdb.search).not.toHaveBeenCalled();
  });
});
