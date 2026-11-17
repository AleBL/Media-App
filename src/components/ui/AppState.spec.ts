import { afterEach, describe, expect, it } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import AppState from '@/components/ui/AppState.vue';

describe('AppState', () => {
  let wrapper: VueWrapper;

  afterEach(() => {
    wrapper.unmount();
  });

  it('announces a failure at once, with what to do about it', () => {
    wrapper = mount(AppState, {
      props: { tone: 'error', icon: 'pi pi-exclamation-triangle' },
      slots: {
        default: 'The search failed.',
        actions: '<button type="button">Try again</button>',
      },
    });

    const state = wrapper.get('[role="alert"]');

    expect(state.text()).toContain('The search failed.');
    expect(state.get('button').text()).toBe('Try again');
    expect(
      state.get('.pi-exclamation-triangle').attributes('aria-hidden'),
    ).toBe('true');
  });

  it('tells calmly that there is nothing, with a title', () => {
    wrapper = mount(AppState, {
      props: { icon: 'pi pi-search', title: 'Nothing found' },
      slots: { default: 'Try other words.' },
    });

    const state = wrapper.get('[role="status"]');

    expect(state.text()).toContain('Nothing found');
    expect(state.text()).toContain('Try other words.');
    expect(state.find('button').exists()).toBe(false);
  });
});
