import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import tmdbLogo from '@/assets/tmdb.svg';
import i18n from '@/plugins/i18n';
import AboutPage from '@/views/AboutPage.vue';

// The notice the terms of the TMDB API ask for
const NOTICE =
  'This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.';

describe('AboutPage', () => {
  let wrapper: VueWrapper;

  const tmdb = () => wrapper.get('section[aria-labelledby="about-tmdb"]');

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    wrapper = mount(AboutPage, { global: { plugins: [i18n] } });
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it('names TMDB as the source of the data, with its notice', () => {
    expect(tmdb().get('h2').text()).toBe('Where the data comes from');
    expect(tmdb().text()).toContain('come from TMDB, The Movie Database.');
    expect(tmdb().get('p[lang="en"]').text()).toBe(NOTICE);
  });

  it('shows the logo of TMDB, linked to its site', () => {
    const link = tmdb().get('a');

    expect(link.attributes('href')).toBe('https://www.themoviedb.org/');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.get('img').attributes('alt')).toBe('The Movie Database (TMDB)');
    expect(link.get('img').attributes('src')).toBe(tmdbLogo);
  });

  it('keeps the notice word for word in the other languages', async () => {
    i18n.global.locale.value = 'pt-BR';
    await wrapper.vm.$nextTick();

    expect(tmdb().get('h2').text()).toBe('De onde vêm os dados');
    expect(tmdb().text()).toContain('vêm do TMDB, The Movie Database.');
    expect(tmdb().get('p[lang="en"]').text()).toBe(NOTICE);
  });
});
