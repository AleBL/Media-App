import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { MediaItem } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import SearchItemCard from '@/components/Search/SearchItemCard.vue';
import { useGenresStore } from '@/stores/genres';
import { useSessionStore } from '@/stores/session';
import { installFakeApi, SIGNED_IN } from '@/test/fakeApi';

const movie: MediaItem = {
  id: 603,
  media_type: 'movie',
  title: 'The Matrix',
  poster_path: '/matrix.jpg',
  genre_ids: [28],
  vote_average: 8.2,
  release_date: '1999-03-31',
};

describe('SearchItemCard', () => {
  let pinia: Pinia;
  let wrapper: VueWrapper | undefined;

  function mountCard(item: MediaItem) {
    wrapper = mount(SearchItemCard, {
      props: { item },
      global: { plugins: [pinia, i18n, router] },
    });

    return wrapper;
  }

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    pinia = createPinia();
    setActivePinia(pinia);
    useGenresStore().byLanguage = {
      en: [
        { id: 28, name: 'Action' },
        { id: 18, name: 'Drama' },
      ],
      'pt-BR': [{ id: 28, name: 'Ação' }],
    };
  });

  // A card left mounted would react to the next test's language change and
  // make its own pinia the active one again.
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
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

  it('is a link to the page of the title, named by the title', () => {
    const link = mountCard(movie).get('a');

    expect(link.attributes('href')).toBe('#/movie/603');
    expect(link.text()).toBe('The Matrix (1999)');
    // nobody signed in: no buttons of the lists of the account
    expect(wrapper!.find('button').exists()).toBe(false);
  });

  it('has the buttons of the lists of the account, for whoever signed in', async () => {
    installFakeApi();
    useSessionStore().state = SIGNED_IN;

    const card = mountCard(movie);
    await flushPromises();

    expect(
      card.findAll('button').map((button) => button.attributes('aria-label')),
    ).toEqual(['My list: The Matrix', 'Favorite: The Matrix']);
    // the link to the page stays one, under them
    expect(card.findAll('a')).toHaveLength(1);
    delete window.api;
  });

  it.each([
    ['the type the search tagged it with', { media_type: 'tv' as const }],
    ['its fields, without a tag', { media_type: undefined }],
  ])('links a tv show to its page by %s', (_case, tag) => {
    const show: MediaItem = { id: 1396, name: 'Breaking Bad', ...tag };

    expect(mountCard(show).get('a').attributes('href')).toBe('#/tv/1396');
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
    expect(wrapper.text()).toContain('Drama');
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

  it('says whether it is a movie or a tv show only when asked', () => {
    const typeOf = (item: MediaItem, showType?: boolean) => {
      const card = mount(SearchItemCard, {
        props: { item, showType },
        global: { plugins: [pinia, i18n, router] },
      });
      const label = card.find('p.uppercase');
      const text = label.exists() ? label.text() : null;

      card.unmount();
      return text;
    };

    expect(typeOf(movie)).toBeNull();
    expect(typeOf(movie, true)).toBe('Movie');
    expect(typeOf({ id: 1396, media_type: 'tv', name: 'Bad' }, true)).toBe(
      'TV Show',
    );
  });

  it('says the rating the user gave, only in the list of rated titles', () => {
    expect(mountCard(movie).text()).not.toContain('Your rating');
    wrapper!.unmount();

    i18n.global.locale.value = 'pt-BR';

    expect(mountCard({ ...movie, rating: 7 }).text()).toContain(
      'Sua nota: 7,0',
    );
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

  it('still renders while the genre names are not loaded', () => {
    useGenresStore().byLanguage = {};

    const wrapper = mountCard(movie);

    expect(wrapper.text()).toContain('The Matrix (1999)');
    expect(wrapper.text()).not.toContain('Action');
  });
});
