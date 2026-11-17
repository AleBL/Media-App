import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import LogoItem from '@/components/About/LogoItem.vue';

function mountLogo(version: string) {
  return mount(LogoItem, {
    props: {
      item: {
        href: 'https://vuejs.org/',
        imgSrc: 'vue.svg',
        imgAlt: 'Vue logo',
        version,
      },
    },
  });
}

describe('LogoItem', () => {
  it('renders one animated span per character of the version', () => {
    const spans = mountLogo('3.5.45').findAll('.waviy span');

    expect(spans.map((span) => span.text()).join('')).toBe('3.5.45');
    expect(spans[0].attributes('style')).toContain('--i: 1');
    expect(spans[5].attributes('style')).toContain('--i: 6');
  });

  it('shows the version as text, never as markup', () => {
    const wrapper = mountLogo('<img src=x onerror=alert(1)>');

    expect(wrapper.find('.waviy img').exists()).toBe(false);
    expect(wrapper.get('.waviy').text()).toBe('<img src=x onerror=alert(1)>');
  });
});
