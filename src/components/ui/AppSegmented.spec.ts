import { afterEach, describe, expect, it } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import AppSegmented from '@/components/ui/AppSegmented.vue';

const OPTIONS = [
  { value: 'auto', label: 'Same as the system', icon: 'pi pi-desktop' },
  { value: 'light', label: 'Light', icon: 'pi pi-sun' },
  { value: 'dark', label: 'Dark', icon: 'pi pi-moon' },
];

describe('AppSegmented', () => {
  let wrapper: VueWrapper;

  afterEach(() => {
    wrapper.unmount();
  });

  function mountGroup(modelValue: string) {
    wrapper = mount(AppSegmented, {
      props: {
        options: OPTIONS,
        label: 'Theme',
        name: 'theme',
        modelValue,
        'onUpdate:modelValue': (value: string) =>
          wrapper.setProps({ modelValue: value }),
      },
    });
  }

  const radios = () => wrapper.findAll('input[type="radio"]');

  it('is a named group of radio buttons, each named by its text', () => {
    mountGroup('light');

    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe(
      'Theme',
    );
    expect(wrapper.findAll('label').map((label) => label.text())).toEqual([
      'Same as the system',
      'Light',
      'Dark',
    ]);
    expect(
      radios().map((radio) => (radio.element as HTMLInputElement).checked),
    ).toEqual([false, true, false]);
    expect(wrapper.find('.pi-sun').attributes('aria-hidden')).toBe('true');
  });

  it('tells which one was chosen', async () => {
    mountGroup('light');

    await radios()[2].setValue(true);

    expect(wrapper.emitted('update:modelValue')).toEqual([['dark']]);
    expect((radios()[2].element as HTMLInputElement).checked).toBe(true);
  });
});
