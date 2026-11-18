import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import AppSpinner from '@/components/ui/AppSpinner.vue';

// Both only draw: what is loading is said by whoever shows them. (The
// comment above each template makes the root a fragment in tests, so the
// span is looked for.)
describe('loading pictures', () => {
  it('a skeleton takes the size it is given, hidden from screen readers', () => {
    const skeleton = mount(AppSkeleton, {
      attrs: { class: 'h-6 w-40' },
    }).get('span');

    expect(skeleton.attributes('aria-hidden')).toBe('true');
    expect(skeleton.classes()).toEqual(
      expect.arrayContaining(['h-6', 'w-40', 'animate-pulse']),
    );
  });

  it('a spinner keeps turning slowly with reduced motion', () => {
    const spinner = mount(AppSpinner, { props: { size: 'lg' } }).get('span');

    expect(spinner.attributes('aria-hidden')).toBe('true');
    expect(spinner.classes()).toEqual(
      expect.arrayContaining([
        'animate-spin',
        'motion-reduce:animate-[spin_2s_linear_infinite]',
        'h-10',
      ]),
    );
  });
});
