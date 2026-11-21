import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import i18n from '@/plugins/i18n';
import appRouter from '@/router';
import { BREAKING_BAD } from '@/test/fakeApi';
import SeasonSwitcher from './SeasonSwitcher.vue';

describe('SeasonSwitcher', () => {
  let router: Router;
  let wrapper: VueWrapper;

  async function mountAt(season: number) {
    await router.push(`/tv/1396/season/${season}`);
    wrapper = mount(SeasonSwitcher, {
      attachTo: document.body,
      props: {
        showId: 1396,
        season,
        seasons: BREAKING_BAD.seasonList!,
        show: 'Breaking Bad',
      },
      global: { plugins: [i18n, router] },
    });
    await flushPromises();
  }

  const link = (name: string) =>
    wrapper.findAll('a').find((one) => one.text() === name);
  // The menu opens in a layer of its own, outside the component.
  const options = () =>
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
    );

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    Element.prototype.scrollIntoView = vi.fn();
    router = createRouter({
      history: createMemoryHistory(),
      routes: appRouter.options.routes,
    });
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it('leads to the season before and after, the specials last', async () => {
    await mountAt(2);

    expect(wrapper.get('nav').attributes('aria-label')).toBe(
      'Seasons of Breaking Bad',
    );
    expect(link('Previous season')!.attributes('href')).toBe(
      '/tv/1396/season/1',
    );
    expect(link('Next season')!.attributes('href')).toBe('/tv/1396/season/0');
    expect(wrapper.get('button').text()).toBe('Season 2');
  });

  it('keeps the step past the ends in its place, but no link', async () => {
    await mountAt(1);

    expect(link('Previous season')).toBeUndefined();
    expect(wrapper.find('span[aria-hidden="true"]').text()).toBe(
      'Previous season',
    );
    expect(link('Next season')!.attributes('href')).toBe('/tv/1396/season/2');
  });

  it('chooses any season from a menu, opened at the one of the page', async () => {
    await mountAt(2);

    await wrapper.get('button').trigger('keydown', { key: 'Enter' });
    await flushPromises();

    // Each season on a line, its year and episodes on the next.
    const lines = options().map((option) =>
      Array.from(option.querySelectorAll('.block'), (line) =>
        line.textContent?.trim(),
      ),
    );
    expect(lines).toEqual([
      ['Season 1', '2008 · 7 episodes'],
      ['Season 2', '2009 · 13 episodes'],
      ['Specials', '2009 · 9 episodes'],
    ]);
    expect(options()[1].getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(options()[1]);

    options()[2].click();
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/tv/1396/season/0');
    expect(options()).toEqual([]);
  });
});
