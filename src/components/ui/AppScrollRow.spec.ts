import { afterEach, describe, expect, it } from 'vitest';
import { h } from 'vue';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import AppScrollRow from '@/components/ui/AppScrollRow.vue';

describe('AppScrollRow', () => {
  let wrapper: VueWrapper;

  afterEach(() => {
    wrapper.unmount();
  });

  // It listens to the scroll once mounted.
  async function mountRow() {
    wrapper = mount(AppScrollRow, {
      props: { previousLabel: 'Previous', nextLabel: 'Next' },
      slots: { default: () => [1, 2, 3].map((n) => h('li', `Card ${n}`)) },
      attachTo: document.body,
    });
    await flushPromises();
  }

  // Where the row is: happy-dom lays nothing out.
  async function scrollTo(left: number, width = 1000) {
    const row = wrapper.get('ul').element;
    Object.defineProperties(row, {
      scrollWidth: { value: width, configurable: true },
      clientWidth: { value: 300, configurable: true },
      scrollLeft: { value: left, configurable: true, writable: true },
    });
    row.dispatchEvent(new Event('scroll'));
    await flushPromises();
  }

  const arrows = () =>
    wrapper.findAll('button').map((button) => button.attributes('aria-label'));
  const row = () => wrapper.get('ul').classes();

  it('scrolls without the bar of the system', async () => {
    await mountRow();

    expect(row()).toEqual(
      expect.arrayContaining(['no-scrollbar', 'overflow-x-auto', 'fade-x']),
    );
  });

  it('at its start, fades out and has an arrow only on the side with more', async () => {
    await mountRow();
    await scrollTo(0);

    expect(arrows()).toEqual(['Next']);
    expect(row()).toContain('[--fade-right:3rem]');
    expect(row()).not.toContain('[--fade-left:3rem]');
  });

  it('in the middle, on both sides', async () => {
    await mountRow();
    await scrollTo(300);

    expect(arrows()).toEqual(['Previous', 'Next']);
    expect(row()).toEqual(
      expect.arrayContaining(['[--fade-left:3rem]', '[--fade-right:3rem]']),
    );
  });

  it('at its end, only back', async () => {
    await mountRow();
    await scrollTo(700);

    expect(arrows()).toEqual(['Previous']);
    expect(row()).not.toContain('[--fade-right:3rem]');
  });

  it('has neither when all of it fits', async () => {
    await mountRow();
    await scrollTo(0, 300);

    expect(arrows()).toEqual([]);
    expect(row().some((name) => name.startsWith('[--fade'))).toBe(false);
  });

  it('has no arrows on a touch screen, where it is swiped', async () => {
    await mountRow();
    await scrollTo(300);

    for (const arrow of wrapper.findAll('button')) {
      expect(arrow.classes()).toContain('pointer-coarse:hidden');
      expect(arrow.attributes('type')).toBe('button');
    }
  });
});
