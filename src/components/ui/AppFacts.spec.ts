import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import { mount } from '@vue/test-utils';
import AppFacts from '@/components/ui/AppFacts.vue';

describe('AppFacts', () => {
  it('lists each fact, with the dots between them drawn and not read', () => {
    const wrapper = mount(AppFacts, {
      props: { facts: ['2008', '47 min', 'Drama, Crime'] },
    });

    expect(wrapper.findAll('li').map((fact) => fact.text())).toEqual([
      '2008',
      '47 min',
      'Drama, Crime',
    ]);
    expect(wrapper.text()).not.toContain('·');
    // Each fact brings its dot; the one of the first of a line is past
    // the left edge, out of sight.
    expect(wrapper.get('ul').classes()).toEqual(
      expect.arrayContaining([
        'flex-wrap',
        '-ml-[var(--fact-gap,1em)]',
        "[&>li]:before:content-['·'_/_'']",
      ]),
    );
  });

  it('puts what it is given first, such as a badge', () => {
    const wrapper = mount(AppFacts, {
      props: { facts: ['2008'] },
      slots: { default: () => h('li', 'L') },
    });

    expect(wrapper.findAll('li').map((fact) => fact.text())).toEqual([
      'L',
      '2008',
    ]);
  });
});
