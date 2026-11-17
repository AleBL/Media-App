import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import AppButton from '@/components/ui/AppButton.vue';

describe('AppButton', () => {
  let wrapper: VueWrapper;

  afterEach(() => {
    wrapper.unmount();
  });

  it('is a button with its label and icon', async () => {
    const onClick = vi.fn();

    wrapper = mount(AppButton, {
      props: { label: 'Save key', icon: 'pi pi-save' },
      attrs: { onClick },
    });

    const button = wrapper.get('button');

    expect(button.attributes('type')).toBe('button');
    expect(button.text()).toBe('Save key');
    expect(button.find('.pi-save').attributes('aria-hidden')).toBe('true');

    await button.trigger('click');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is a link that opens in the browser when it has an address', () => {
    wrapper = mount(AppButton, {
      props: { label: 'See on IMDb', href: 'https://www.imdb.com/' },
    });

    const link = wrapper.get('a');

    expect(link.attributes('href')).toBe('https://www.imdb.com/');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
  });

  it('waits with a spinner, and cannot be pressed meanwhile', () => {
    wrapper = mount(AppButton, {
      props: { label: 'Save key', icon: 'pi pi-save', loading: true },
      // Even when the page says it could be pressed.
      attrs: { disabled: false },
    });

    const button = wrapper.get('button');

    expect(button.attributes('aria-busy')).toBe('true');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.find('.pi-save').exists()).toBe(false);
    expect(button.find('.animate-spin').exists()).toBe(true);
    expect(button.text()).toBe('Save key');
  });

  it('passes the rest to the button, such as a name', () => {
    wrapper = mount(AppButton, {
      props: { icon: 'pi pi-times', severity: 'ghost' },
      attrs: { 'aria-label': 'Dismiss', disabled: true },
    });

    const button = wrapper.get('button');

    expect(button.attributes('aria-label')).toBe('Dismiss');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.attributes('aria-busy')).toBeUndefined();
  });
});
