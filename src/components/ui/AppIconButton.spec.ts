import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import AppIconButton from '@/components/ui/AppIconButton.vue';

describe('AppIconButton', () => {
  let wrapper: VueWrapper;

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  function mountButton(onClick = vi.fn()) {
    wrapper = mount(AppIconButton, {
      props: { icon: 'pi pi-cog', label: 'Settings' },
      attrs: { onClick },
      attachTo: document.body,
    });

    return wrapper.get('button');
  }

  it('is named by its label, and shows only the icon', async () => {
    const onClick = vi.fn();
    const button = mountButton(onClick);

    expect(button.attributes('aria-label')).toBe('Settings');
    expect(button.text()).toBe('');
    expect(button.find('.pi-cog').exists()).toBe(true);

    await button.trigger('click');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows the label as a hint on keyboard focus', async () => {
    const button = mountButton();

    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    await button.trigger('focus');
    await flushPromises();

    expect(document.querySelector('[role="tooltip"]')?.textContent).toContain(
      'Settings',
    );
  });
});
