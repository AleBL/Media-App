import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import AppTooltip from '@/components/ui/AppTooltip.vue';

describe('AppTooltip', () => {
  it('breaks a long hint in lines, to stay inside a narrow screen', async () => {
    const wrapper = mount(AppTooltip, {
      props: { text: 'Age rating: 16. Not recommended for people under 16' },
      slots: { default: () => h('button', '16') },
      attachTo: document.body,
    });

    await wrapper.get('button').trigger('focus');
    await flushPromises();

    const hint = document.body.querySelector('[data-side="bottom"]');
    // with the copy for screen readers, inside
    expect(hint?.textContent).toContain(
      'Age rating: 16. Not recommended for people under 16',
    );
    expect(hint?.classList).toContain('max-w-[min(20rem,calc(100vw-1rem))]');

    wrapper.unmount();
  });
});
