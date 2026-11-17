import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import i18n from '@/plugins/i18n';
import AppPaginator from '@/components/ui/AppPaginator.vue';

describe('AppPaginator', () => {
  let wrapper: VueWrapper;

  function mountPaginator(page: number, totalPages: number) {
    wrapper = mount(AppPaginator, {
      props: { page, totalPages },
      global: { plugins: [i18n] },
    });
  }

  const numbers = () =>
    wrapper.findAll('.paginator-pages button').map((button) => button.text());
  const button = (label: string) =>
    wrapper
      .findAll('button')
      .find((found) => found.attributes('aria-label') === label)!;

  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it('is not there when everything fits on one page', () => {
    mountPaginator(1, 1);

    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('offers every page when there are few', () => {
    mountPaginator(1, 3);

    expect(wrapper.get('nav').attributes('aria-label')).toBe(
      'Pages of results',
    );
    expect(numbers()).toEqual(['1', '2', '3']);
    expect(button('Page 1').attributes('aria-current')).toBe('page');
    expect(button('Page 2').attributes('aria-current')).toBeUndefined();
  });

  it.each([
    [1, ['1', '2', '3', '4', '5']],
    [5, ['3', '4', '5', '6', '7']],
    [20, ['16', '17', '18', '19', '20']],
  ])('keeps page %i among five numbers', (page, expected) => {
    mountPaginator(page, 20);

    expect(numbers()).toEqual(expected);
  });

  it('asks for the page that was chosen', async () => {
    mountPaginator(5, 20);

    await button('Page 6').trigger('click');
    await button('First page').trigger('click');
    await button('Previous page').trigger('click');
    await button('Next page').trigger('click');
    await button('Last page').trigger('click');

    expect(wrapper.emitted('change')).toEqual([[6], [1], [4], [6], [20]]);
  });

  it('does not ask for the page already shown, or past the ends', async () => {
    mountPaginator(1, 3);

    await button('Page 1').trigger('click');

    expect(button('First page').attributes('disabled')).toBeDefined();
    expect(button('Previous page').attributes('disabled')).toBeDefined();
    expect(button('Next page').attributes('disabled')).toBeUndefined();
    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('speaks the language of the app', () => {
    i18n.global.locale.value = 'pt-BR';
    mountPaginator(2, 3);

    expect(button('Próxima página').exists()).toBe(true);
    expect(button('Página 3').text()).toBe('3');
  });
});
