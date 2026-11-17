import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import i18n from '@/plugins/i18n';
import AppToaster from '@/components/ui/AppToaster.vue';
import { useToastsStore } from '@/stores/toasts';

describe('AppToaster', () => {
  let wrapper: VueWrapper;
  let store: ReturnType<typeof useToastsStore>;

  const buttons = () =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('li button'));

  beforeEach(async () => {
    i18n.global.locale.value = 'en';
    const pinia = createPinia();
    setActivePinia(pinia);
    store = useToastsStore();
    wrapper = mount(AppToaster, {
      attachTo: document.body,
      global: { plugins: [pinia, i18n] },
    });
    await flushPromises();
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('shows a notice, with its action, and takes it away once used', async () => {
    const undo = vi.fn();

    store.show('Added to My list.', { label: 'Undo', run: undo });
    await flushPromises();

    expect(document.body.textContent).toContain('Added to My list.');
    expect(buttons().map((button) => button.textContent?.trim())).toEqual([
      'Undo',
      '',
    ]);

    buttons()[0].click();
    await flushPromises();

    expect(undo).toHaveBeenCalledOnce();
    expect(store.toasts).toEqual([]);
  });

  it('closes a notice from its own button', async () => {
    store.show('Marked as watched.');
    await flushPromises();

    const close = buttons()[0];
    expect(close.getAttribute('aria-label')).toBe('Dismiss');

    close.click();
    await flushPromises();

    expect(store.toasts).toEqual([]);
  });
});
