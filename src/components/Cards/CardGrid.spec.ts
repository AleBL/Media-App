import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { SearchItem } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import CardGrid from '@/components/Cards/CardGrid.vue';
import CardViewPicker from '@/components/Cards/CardViewPicker.vue';
import { useGenresStore } from '@/stores/genres';
import { useSettingsStore } from '@/stores/settings';
import { installFakeApi } from '@/test/fakeApi';

const ITEMS: SearchItem[] = [
  {
    id: 603,
    media_type: 'movie',
    title: 'Matrix',
    release_date: '1999-03-31',
    genre_ids: [28],
    vote_average: 8.2,
    overview: 'A hacker learns the truth about his reality.',
  },
  {
    id: 6384,
    media_type: 'person',
    name: 'Keanu Reeves',
    known_for: [{ id: 603, media_type: 'movie', title: 'Matrix' }],
  },
];

describe('CardGrid', () => {
  let pinia: Pinia;
  let wrapper: VueWrapper;

  function mountGrid() {
    wrapper = mount(CardGrid, {
      props: { items: ITEMS },
      global: { plugins: [pinia, i18n, router] },
    });
  }

  const list = () => wrapper.get('ul');

  beforeEach(() => {
    localStorage.clear();
    i18n.global.locale.value = 'en';
    installFakeApi();
    pinia = createPinia();
    setActivePinia(pinia);
    useGenresStore().byLanguage = { en: [{ id: 28, name: 'Action' }] };
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('is a grid of medium cards at first, with the genres', () => {
    mountGrid();

    expect(list().classes()).toContain('card-grid');
    expect(
      list()
        .classes()
        .some((name) => name.startsWith('[--card')),
    ).toBe(false);
    expect(wrapper.text()).toContain('Matrix (1999)');
    expect(wrapper.text()).toContain('Action');
    expect(wrapper.text()).not.toContain('A hacker learns');
  });

  it('has small cards, more of them and without the genres', async () => {
    useSettingsStore().cardView = 'small';
    mountGrid();
    await flushPromises();

    expect(list().classes()).toContain('[--card-width:6.5rem]');
    expect(wrapper.text()).toContain('Matrix (1999)');
    expect(wrapper.text()).not.toContain('Action');
  });

  it('has large cards, one to a phone', async () => {
    useSettingsStore().cardView = 'large';
    mountGrid();
    await flushPromises();

    expect(list().classes()).toEqual(
      expect.arrayContaining(['[--card-width:18rem]', '[--card-cap:100%]']),
    );
  });

  it('lists the titles with their synopsis, and the people too', async () => {
    useSettingsStore().cardView = 'list';
    mountGrid();
    await flushPromises();

    const [title, person] = wrapper.findAll('li');

    expect(list().classes()).not.toContain('card-grid');
    expect(title.text()).toContain('Matrix');
    expect(title.text()).toContain('(1999)');
    expect(title.text()).toContain(
      'A hacker learns the truth about his reality.',
    );
    expect(title.text()).toContain('Action');
    expect(title.get('a').attributes('href')).toBe('#/movie/603');
    expect(person.text()).toContain('Keanu Reeves');
    expect(person.text()).toContain('Known for');
    expect(person.findAll('a').map((link) => link.attributes('href'))).toEqual([
      '#/person/6384',
      '#/movie/603',
    ]);
  });

  it('takes medium for a view it does not know', async () => {
    localStorage.setItem('card-view', 'huge');
    mountGrid();
    await flushPromises();

    expect(useSettingsStore().view).toBe('medium');
    expect(list().classes()).toContain('card-grid');
  });

  it('changes with the choice of the picker, kept for the next time', async () => {
    mountGrid();
    const picker = mount(CardViewPicker, {
      props: { name: 'test-view' },
      global: { plugins: [pinia, i18n] },
    });

    expect(picker.findAll('label').map((label) => label.text())).toEqual([
      'Small',
      'Medium',
      'Large',
      'List',
    ]);
    expect(
      (picker.get('input[value="medium"]').element as HTMLInputElement).checked,
    ).toBe(true);

    await picker.get('input[value="list"]').setValue(true);
    await flushPromises();

    expect(localStorage.getItem('card-view')).toBe('list');
    expect(wrapper.text()).toContain('A hacker learns');
    picker.unmount();
  });
});
