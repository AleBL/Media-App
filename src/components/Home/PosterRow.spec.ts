import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import type { MediaItem } from '@shared/api';
import i18n from '@/plugins/i18n';
import router from '@/router';
import PosterRow from '@/components/Home/PosterRow.vue';
import { installFakeApi } from '@/test/fakeApi';

const movie = (id: number): MediaItem => ({
  id,
  media_type: 'movie',
  title: `Movie ${id}`,
});

describe('PosterRow', () => {
  let wrapper: VueWrapper;

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
    delete window.api;
  });

  async function mountRow() {
    installFakeApi();
    i18n.global.locale.value = 'en';
    wrapper = mount(PosterRow, {
      props: { items: [movie(1), movie(2), movie(3)], busy: false },
      attachTo: document.body,
      global: { plugins: [createPinia(), i18n, router] },
    });
    await flushPromises();
  }

  it('has a card per title, in a list that scrolls sideways', async () => {
    await mountRow();

    expect(wrapper.findAll('li article')).toHaveLength(3);
    expect(wrapper.get('ul').classes()).toContain('overflow-x-auto');
  });

  it('moves about a screen of cards with its arrow, and has none back at the start', async () => {
    await mountRow();
    const row = wrapper.get('ul').element;
    const scrollBy = vi.fn();
    // Wider than its box, at its start.
    Object.defineProperties(row, {
      scrollWidth: { value: 1000 },
      clientWidth: { value: 300 },
    });
    Object.assign(row, { scrollBy });
    row.dispatchEvent(new Event('scroll'));
    await flushPromises();

    expect(wrapper.find('button[aria-label="Previous titles"]').exists()).toBe(
      false,
    );

    await wrapper.get('button[aria-label="Next titles"]').trigger('click');

    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: expect.any(Number) }),
    );
  });
});
