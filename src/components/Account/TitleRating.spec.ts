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

  const select = () => wrapper.get('select');
  const shown = () =>
    (select().element as HTMLSelectElement).selectedOptions[0].text;
  /** Picks the option that says `text`, as the user would. */
  function choose(text: string) {
    const option = select()
      .findAll('option')
      .find((found) => found.text() === text)!;

    (option.element as HTMLOptionElement).selected = true;

    return select().trigger('change');
  }

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

  it('is a select named by its label, from none to 10 in steps of 0.5', async () => {
    await mountRating(null);

    const id = select().attributes('id');
    expect(wrapper.get(`label[for="${id}"]`).text()).toBe('Your rating');

    const options = select().findAll('option');
    expect(options).toHaveLength(21);
    expect(options.slice(0, 4).map((option) => option.text())).toEqual([
      'Not rated',
      '0.5',
      '1.0',
      '1.5',
    ]);
    expect(options.at(-1)!.text()).toBe('10.0');
    expect(shown()).toBe('Not rated');
  });

  it('waits for TMDB to say what the rating is', async () => {
    await mountRating('unknown');

    expect(select().attributes('disabled')).toBeDefined();
  });

  it('shows the rating the title has', async () => {
    await mountRating(8.5);

    expect(select().attributes('disabled')).toBeUndefined();
    expect(shown()).toBe('8.5');
  });

  it('rates the title as soon as a rating is chosen', async () => {
    await mountRating(null);

    await choose('9.0');
    await flushPromises();

    expect(api.account.rate).toHaveBeenCalledWith({ ...MATRIX, value: 9 });
    expect(shown()).toBe('9.0');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('takes the rating away with "Not rated"', async () => {
    await mountRating(6);

    await choose('Not rated');
    await flushPromises();

    expect(api.account.rate).toHaveBeenCalledWith({ ...MATRIX, value: null });
    expect(shown()).toBe('Not rated');
  });

  it('goes back with a message when TMDB refuses', async () => {
    await mountRating(6);
    let answer!: (result: Result<null>) => void;
    api.account.rate.mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );

    await choose('3.0');

    expect(shown()).toBe('3.0');

    answer({ ok: false, error: { code: 'network' } });
    await flushPromises();

    expect(shown()).toBe('6.0');
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

    expect(shown()).toBe('8,5');
    expect(select().findAll('option')[0].text()).toBe('Sem nota');
  });
});
