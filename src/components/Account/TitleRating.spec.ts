import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import TitleRating from '@/components/Account/TitleRating.vue';
import { useAccountStore } from '@/stores/account';
import { useSessionStore } from '@/stores/session';
import { installFakeApi, SIGNED_IN } from '@/test/fakeApi';

const MATRIX = { type: 'movie', id: 603 } as const;

describe('TitleRating', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let wrapper: VueWrapper;

  /** The rating TMDB says the title has, as the page of the title asks. */
  async function mountRating(rated: number | null | 'unknown') {
    if (rated !== 'unknown') {
      api.account.states.mockResolvedValue({
        ok: true,
        data: { watchlist: false, favorite: false, rated },
      });
      await useAccountStore().load(MATRIX);
    }

    wrapper = mount(TitleRating, {
      props: MATRIX,
      global: { plugins: [pinia, i18n] },
    });
    await flushPromises();
  }

  const group = () => wrapper.get('[role="radiogroup"]');
  const radios = () => group().findAll('input[type="radio"]');
  /** The number a screen reader reads for each half of a star. */
  const names = () =>
    group()
      .findAll('label')
      .map((label) => label.text());
  const checked = () => {
    const index = radios().findIndex(
      (radio) => (radio.element as HTMLInputElement).checked,
    );

    return index < 0 ? null : names()[index];
  };
  /** Picks the half star that reads `text`, as the user would. */
  function choose(text: string) {
    const index = names().indexOf(text);
    const radio = radios()[index];

    (radio.element as HTMLInputElement).checked = true;

    return radio.trigger('change');
  }
  const removeButton = () =>
    wrapper
      .findAll('button')
      .find(
        (button) => button.attributes('aria-label') === 'Remove the rating',
      );

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    pinia = createPinia();
    setActivePinia(pinia);
    useSessionStore().state = SIGNED_IN;
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  it('is a group of ten stars in halves, from 0.5 to 10, named by its label', async () => {
    await mountRating(null);

    const id = group().attributes('aria-labelledby');
    expect(wrapper.get(`#${id}`).text()).toBe('Your rating');
    expect(radios()).toHaveLength(20);
    expect(names().slice(0, 3)).toEqual(['0.5', '1.0', '1.5']);
    expect(names().at(-1)).toBe('10.0');
    expect(wrapper.findAll('.pi-star')).toHaveLength(10);
    expect(checked()).toBeNull();
    expect(wrapper.text()).toContain('Not rated');
    expect(removeButton()).toBeUndefined();
  });

  it('waits for TMDB to say what the rating is', async () => {
    await mountRating('unknown');

    expect(
      radios().every((radio) => radio.attributes('disabled') !== undefined),
    ).toBe(true);
  });

  it('shows the rating the title has, in full and half stars', async () => {
    await mountRating(8.5);

    expect(radios()[0].attributes('disabled')).toBeUndefined();
    expect(checked()).toBe('8.5');
    expect(wrapper.findAll('.pi-star-fill')).toHaveLength(8);
    expect(wrapper.findAll('.pi-star-half-fill')).toHaveLength(1);
    expect(wrapper.findAll('.pi-star')).toHaveLength(1);
  });

  it('rates the title as soon as a rating is chosen', async () => {
    await mountRating(null);

    await choose('9.0');
    await flushPromises();

    expect(api.account.rate).toHaveBeenCalledWith({ ...MATRIX, value: 9 });
    expect(checked()).toBe('9.0');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('shows the rating with the way to take it away, together', async () => {
    await mountRating(8.5);

    const button = removeButton()!;
    const pill = button.element.parentElement!;

    expect(pill.textContent?.trim()).toBe('8.5');
    expect(pill.className).toContain('rounded-full');
    expect(button.find('.pi-times').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Not rated');
  });

  it('takes the rating away with its own button', async () => {
    await mountRating(6);

    await removeButton()!.trigger('click');
    await flushPromises();

    expect(api.account.rate).toHaveBeenCalledWith({ ...MATRIX, value: null });
    expect(checked()).toBeNull();
    expect(removeButton()).toBeUndefined();
  });

  it('goes back with a message when TMDB refuses', async () => {
    await mountRating(6);
    let answer!: (result: Result<null>) => void;
    api.account.rate.mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );

    await choose('3.0');

    expect(checked()).toBe('3.0');

    answer({ ok: false, error: { code: 'network' } });
    await flushPromises();

    expect(checked()).toBe('6.0');
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'The rating could not be saved. Try again.',
    );
  });

  it('says nothing of a failure that signed the user out', async () => {
    await mountRating(6);
    api.account.rate.mockResolvedValue({
      ok: false,
      error: { code: 'signed-out' },
    });

    await choose('3.0');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('writes the ratings the way the language does', async () => {
    i18n.global.locale.value = 'pt-BR';

    await mountRating(8.5);

    expect(checked()).toBe('8,5');
    expect(removeButton()).toBeUndefined();
    expect(wrapper.find('button[aria-label="Tirar a nota"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain('8,5');
  });
});
