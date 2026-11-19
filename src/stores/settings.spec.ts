import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '@/stores/settings';

describe('settings store', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    delete root.dataset.uiSize;
    setActivePinia(createPinia());
  });

  afterEach(() => {
    delete root.dataset.uiSize;
  });

  it('leaves the size of the interface to the screen at first', () => {
    expect(useSettingsStore().uiSize).toBe('auto');
    expect(root.dataset.uiSize).toBeUndefined();
  });

  it('puts the size chosen on the page, and keeps it', async () => {
    const settings = useSettingsStore();

    settings.uiSize = '110';
    await nextTick();

    expect(root.dataset.uiSize).toBe('110');
    expect(localStorage.getItem('ui-size')).toBe('110');

    settings.uiSize = 'auto';
    await nextTick();

    expect(root.dataset.uiSize).toBeUndefined();
  });

  it('takes the size kept from before, at once', () => {
    localStorage.setItem('ui-size', '90');

    useSettingsStore();

    expect(root.dataset.uiSize).toBe('90');
  });

  it('ignores a size it does not know', () => {
    localStorage.setItem('ui-size', '300');

    useSettingsStore();

    expect(root.dataset.uiSize).toBeUndefined();
  });

  it('keeps the services of the user, each once', async () => {
    const settings = useSettingsStore();

    expect(settings.myServices).toEqual([]);

    settings.setMyServices([8, 119, 8]);
    await nextTick();

    expect(settings.myServices).toEqual([8, 119]);
    expect(JSON.parse(localStorage.getItem('my-services')!)).toEqual([8, 119]);
  });

  it.each([
    ['ids among other things', '[8, "119", -1, 1.5, null, 337]', [8, 337]],
    ['something that is not a list', '{"8": true}', []],
    ['something that is not JSON', 'netflix', []],
  ])('keeps only ids from %s kept before', (_case, kept, ids) => {
    localStorage.setItem('my-services', kept);

    expect(useSettingsStore().myServices).toEqual(ids);
  });
});
