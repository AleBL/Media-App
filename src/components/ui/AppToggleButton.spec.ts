import { afterEach, describe, expect, it } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import AppToggleButton from '@/components/ui/AppToggleButton.vue';

describe('AppToggleButton', () => {
  let wrapper: VueWrapper;

  afterEach(() => {
    wrapper.unmount();
  });

  const mountToggle = (props: { pressed?: boolean; loading?: boolean }) => {
    wrapper = mount(AppToggleButton, {
      props: {
        label: 'Favorite',
        icon: 'pi pi-heart',
        pressedIcon: 'pi pi-heart-fill',
        ...props,
      },
    });

    return wrapper.get('button');
  };

  it('says it is off, with the outline icon', () => {
    const button = mountToggle({ pressed: false });

    expect(button.attributes('aria-pressed')).toBe('false');
    expect(button.find('.pi-heart').exists()).toBe(true);
    expect(button.text()).toBe('Favorite');
  });

  it('says it is on, with the filled icon and the same label', () => {
    const button = mountToggle({ pressed: true });

    expect(button.attributes('aria-pressed')).toBe('true');
    expect(button.find('.pi-heart-fill').exists()).toBe(true);
    expect(button.text()).toBe('Favorite');
  });

  it('says nothing while it is not known', () => {
    const button = mountToggle({});

    expect(button.attributes('aria-pressed')).toBeUndefined();
  });

  it('cannot be pressed again while the change is saved', () => {
    const button = mountToggle({ pressed: true, loading: true });

    expect(button.attributes('aria-busy')).toBe('true');
    expect(button.attributes('aria-disabled')).toBe('true');
    expect(button.attributes('aria-pressed')).toBe('true');
  });
});
