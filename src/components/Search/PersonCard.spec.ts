import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import type { PersonItem } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import PersonCard from '@/components/Search/PersonCard.vue';

const keanu: PersonItem = {
  id: 6384,
  media_type: 'person',
  name: 'Keanu Reeves',
  profile_path: '/keanu.jpg',
  known_for: [
    {
      id: 603,
      media_type: 'movie',
      title: 'The Matrix',
      release_date: '1999-03-31',
    },
    { id: 1396, media_type: 'tv', name: 'Breaking Bad' },
  ],
};

describe('PersonCard', () => {
  let wrapper: VueWrapper | undefined;

  function mountCard(person: PersonItem) {
    wrapper = mount(PersonCard, {
      props: { person },
      global: { plugins: [i18n, router] },
    });

    return wrapper;
  }

  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('shows the name and the picture of someone, as a person', () => {
    const card = mountCard(keanu);

    expect(card.get('article').text()).toContain('Person');
    expect(card.text()).toContain('Keanu Reeves');

    const img = card.get('img');
    expect(img.attributes('src')).toBe(
      'https://image.tmdb.org/t/p/h632/keanu.jpg',
    );
    // the name is right below it
    expect(img.attributes('alt')).toBe('');
  });

  it('leads to the page of the person by their name, and to each title they are known for', () => {
    const links = mountCard(keanu).findAll('a');

    expect(links.map((link) => link.text())).toEqual([
      'Keanu Reeves',
      'The Matrix (1999)',
      'Breaking Bad',
    ]);
    expect(links.map((link) => link.attributes('href'))).toEqual([
      '#/person/6384',
      '#/movie/603',
      '#/tv/1396',
    ]);
    // the name is the heading of the card, and its link covers it
    expect(links[0].element.parentElement!.tagName).toBe('H3');
  });

  it('leads to the page of the person from a line of the list too', () => {
    wrapper = mount(PersonCard, {
      props: { person: keanu, list: true },
      global: { plugins: [i18n, router] },
    });

    expect(wrapper.get('h3 a').attributes('href')).toBe('#/person/6384');
    expect(wrapper.findAll('a')).toHaveLength(3);
  });

  it('has a placeholder for someone without a picture or known titles', () => {
    const card = mountCard({
      ...keanu,
      profile_path: undefined,
      known_for: [],
    });

    expect(card.find('img').exists()).toBe(false);
    expect(card.find('.pi-user').exists()).toBe(true);
    expect(card.text()).not.toContain('Known for');
    expect(card.findAll('a')).toHaveLength(1);
  });

  it('is in the language of the app', () => {
    i18n.global.locale.value = 'pt-BR';

    const card = mountCard(keanu);

    expect(card.text()).toContain('Pessoa');
    expect(card.text()).toContain('Conhecido(a) por');
  });
});
