import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import i18n from '@/plugins/i18n';
import appRouter from '@/router';
import { installFakeApi, KEANU } from '@/test/fakeApi';
import PersonPage from '@/views/PersonPage.vue';

describe('PersonPage', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let router: Router;
  let wrapper: VueWrapper;

  async function open(query = '') {
    await router.push(`/person/6384${query}`);
    wrapper = mount(PersonPage, {
      props: { id: 6384 },
      global: { plugins: [pinia, i18n, router] },
    });
    await flushPromises();
  }

  const facts = () =>
    wrapper
      .findAll('dl dt')
      .map((term) => [
        term.text(),
        term.element.nextElementSibling!.textContent,
      ]);
  const titles = () => wrapper.findAll('article h3').map((name) => name.text());
  const radio = (name: string, value: string) =>
    wrapper.get(`input[name="${name}"][value="${value}"]`);

  async function choose(name: string, value: string) {
    await radio(name, value).setValue(true);
    await flushPromises();
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 18, 12));
    localStorage.clear();
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    pinia = createPinia();
    setActivePinia(pinia);
    router = createRouter({
      history: createMemoryHistory(),
      routes: appRouter.options.routes,
    });
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
    vi.useRealTimers();
    delete window.api;
  });

  it('shows who the person is, with their age today', async () => {
    await open();

    expect(api.tmdb.person).toHaveBeenCalledWith({ id: 6384, language: 'en' });
    expect(wrapper.get('h1').text()).toBe('Keanu Reeves');
    expect(facts()).toEqual([
      ['Known for', 'Acting'],
      ['Born', 'September 2, 1964 (62 years old)'],
      ['Place of birth', 'Beirut, Lebanon'],
    ]);
    expect(wrapper.get('#person-biography').text()).toBe(
      'Keanu Charles Reeves is a Canadian actor.\n\nHe is known for The Matrix and John Wick.',
    );
    expect(wrapper.find('[lang="en"]').exists()).toBe(false);
    expect(wrapper.get('img').attributes('src')).toBe(
      'https://image.tmdb.org/t/p/h632/keanu.jpg',
    );
  });

  it('says when they died, and at what age', async () => {
    api.tmdb.person.mockResolvedValue({
      ok: true,
      data: { ...KEANU, birthday: '1940-03-01', deathday: '2016-02-29' },
    });

    await open();

    expect(facts()).toContainEqual(['Born', 'March 1, 1940']);
    expect(facts()).toContainEqual(['Died', 'February 29, 2016 (at age 75)']);
  });

  it('says the biography is in English when TMDB has none in the language', async () => {
    i18n.global.locale.value = 'pt-BR';
    api.tmdb.person.mockResolvedValue({
      ok: true,
      data: { ...KEANU, biographyLanguage: 'en' },
    });

    await open();

    expect(wrapper.text()).toContain('O TMDB só tem esta biografia em inglês.');
    expect(wrapper.get('#person-biography').attributes('lang')).toBe('en');
    expect(facts()[0]).toEqual(['Área', 'Atuação']);
  });

  it('links to IMDb and to their profiles, to open in the browser', async () => {
    await open();

    const imdb = wrapper.get('a[href^="https://www.imdb.com/"]');
    expect(imdb.attributes('href')).toBe(
      'https://www.imdb.com/name/nm0000206/',
    );
    expect(imdb.text()).toBe('See on IMDb');
    const instagram = wrapper.get('a[aria-label="Instagram"]');
    expect(instagram.attributes('href')).toBe(
      'https://www.instagram.com/keanu.example/',
    );
    expect(instagram.attributes('target')).toBe('_blank');
    expect(wrapper.find('a[aria-label="X"]').exists()).toBe(false);
  });

  it('shows what they played, with who they were', async () => {
    await open();

    expect(titles()).toEqual([
      'The Matrix (1999)',
      'John Wick (2014)',
      'Swedish Dicks (2016)',
    ]);
    expect(wrapper.get('article').text()).toContain('Neo');
    // movies and tv shows among them: each says what it is
    expect(wrapper.text()).toContain('TV Show');
  });

  it('shows what they did behind the camera, kept in the address', async () => {
    await open();

    expect(wrapper.text()).toContain('Acting (3)');
    await choose('person-role', 'crew');

    expect(router.currentRoute.value.query).toEqual({ role: 'crew' });
    expect(titles()).toEqual(['Man of Tai Chi (2013)']);
    expect(wrapper.get('article').text()).toContain('Directing');
    // only movies there: no choice of kind
    expect(wrapper.find('input[name="person-kind"]').exists()).toBe(false);
  });

  it('shows the movies or the tv shows, the best known or the most recent first', async () => {
    await open();

    await choose('person-kind', 'tv');
    expect(titles()).toEqual(['Swedish Dicks (2016)']);

    await choose('person-kind', 'all');
    await choose('person-order', 'recent');
    expect(titles()).toEqual([
      'Swedish Dicks (2016)',
      'John Wick (2014)',
      'The Matrix (1999)',
    ]);
    expect(router.currentRoute.value.query).toEqual({ order: 'recent' });
  });

  it('opens with the filters of its address, as when coming back to it', async () => {
    await open('?type=movie&order=recent');

    expect(titles()).toEqual(['John Wick (2014)', 'The Matrix (1999)']);
    expect(
      (radio('person-kind', 'movie').element as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('starts behind the camera for someone known for it', async () => {
    api.tmdb.person.mockResolvedValue({
      ok: true,
      data: { ...KEANU, department: 'Directing' },
    });

    await open();

    expect(titles()).toEqual(['Man of Tai Chi (2013)']);
  });

  it('says when TMDB has no titles of the person', async () => {
    api.tmdb.person.mockResolvedValue({
      ok: true,
      data: { ...KEANU, cast: [], crew: [] },
    });

    await open();

    expect(wrapper.text()).toContain('TMDB has no titles of this person.');
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false);
  });

  it('asks again in the language chosen in the menu', async () => {
    await open();

    i18n.global.locale.value = 'es';
    await nextTick();
    await flushPromises();

    expect(api.tmdb.person).toHaveBeenLastCalledWith({
      id: 6384,
      language: 'es',
    });
    expect(wrapper.get('h2').text()).toBe('Biografía');
  });

  it('says when TMDB does not have the person, with nothing to retry', async () => {
    api.tmdb.person.mockResolvedValue({
      ok: false,
      error: { code: 'not-found', status: 404 },
    });

    await open();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'This person was not found on TMDB.',
    );
    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      'Back',
    ]);
  });

  it('offers to try again after a failure of the connection', async () => {
    api.tmdb.person.mockResolvedValueOnce({
      ok: false,
      error: { code: 'network' },
    });

    await open();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Try again')!
      .trigger('click');
    await flushPromises();

    expect(wrapper.get('h1').text()).toBe('Keanu Reeves');
  });
});
