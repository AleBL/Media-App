import { afterEach, describe, expect, it } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import AppImage from '@/components/ui/AppImage.vue';

const POSTER = 'https://image.tmdb.org/t/p/w342/matrix.jpg';

describe('AppImage', () => {
  let wrapper: VueWrapper;

  afterEach(() => {
    wrapper.unmount();
  });

  const box = () => wrapper.get('[data-state]');

  it('keeps the space of the image, and fades it in once loaded', async () => {
    wrapper = mount(AppImage, { props: { src: POSTER, alt: 'Matrix' } });

    expect(box().classes()).toContain('aspect-[2/3]');
    expect(box().attributes('data-state')).toBe('loading');
    expect(wrapper.get('img').classes()).toContain('opacity-0');
    expect(wrapper.get('img').attributes('loading')).toBe('lazy');

    await wrapper.get('img').trigger('load');

    expect(box().attributes('data-state')).toBe('loaded');
    expect(wrapper.get('img').classes()).toContain('opacity-100');
    expect(wrapper.get('img').attributes('alt')).toBe('Matrix');
  });

  it('shows the icon when the image fails, still named', async () => {
    wrapper = mount(AppImage, {
      props: { src: POSTER, alt: 'Matrix', icon: 'pi pi-user' },
    });

    await wrapper.get('img').trigger('error');

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('Matrix');
    expect(wrapper.find('.pi-user').exists()).toBe(true);
  });

  it('shows the icon at once without an image, hidden when decorative', () => {
    wrapper = mount(AppImage, { props: { src: null, shape: 'square' } });

    expect(box().attributes('data-state')).toBe('failed');
    expect(box().classes()).toContain('aspect-square');
    expect(wrapper.find('[role="img"]').exists()).toBe(false);
    expect(wrapper.find('.pi-image').attributes('aria-hidden')).toBe('true');
  });

  it('loads again for another image', async () => {
    wrapper = mount(AppImage, { props: { src: POSTER } });
    await wrapper.get('img').trigger('error');

    await wrapper.setProps({
      src: 'https://image.tmdb.org/t/p/w342/other.jpg',
    });

    expect(box().attributes('data-state')).toBe('loading');
    expect(wrapper.get('img').attributes('src')).toContain('other.jpg');
  });

  it('does not wait to load an image at the top of the page', () => {
    wrapper = mount(AppImage, { props: { src: POSTER, eager: true } });

    expect(wrapper.get('img').attributes('loading')).toBe('eager');
  });
});
