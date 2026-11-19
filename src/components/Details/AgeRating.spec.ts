import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import type { Certification } from '@shared/api';
import i18n from '@/plugins/i18n';
import AgeRating from '@/components/Details/AgeRating.vue';

describe('AgeRating', () => {
  let wrapper: VueWrapper;

  async function mountBadge(certification: Certification, region: string) {
    wrapper = mount(AgeRating, {
      props: { certification, region },
      attachTo: document.body,
      global: { plugins: [i18n] },
    });
    await flushPromises();
  }

  const badge = () => wrapper.get('[role="img"]');

  beforeEach(() => {
    i18n.global.locale.value = 'pt-BR';
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('shows a rating of Brazil in the colors of the ClassInd, with what it means', async () => {
    await mountBadge({ country: 'BR', code: '14' }, 'BR');

    expect(badge().text()).toBe('14');
    expect(badge().attributes('aria-label')).toBe(
      'Classificação indicativa: 14. Não recomendado para menores de 14 anos',
    );
    expect(badge().classes()).toEqual(
      expect.arrayContaining(['bg-classind-14', 'text-black']),
    );
    // the keyboard reaches it, for the hint
    expect(badge().attributes('tabindex')).toBe('0');
  });

  it('says when a title is for everyone', async () => {
    await mountBadge({ country: 'BR', code: 'L' }, 'BR');

    expect(badge().attributes('aria-label')).toBe(
      'Classificação indicativa: L. Livre para todos os públicos',
    );
    expect(badge().classes()).toContain('bg-classind-l');
  });

  it('says whose it is when the region has no rating, plain', async () => {
    await mountBadge({ country: 'US', code: 'PG-13' }, 'BR');

    expect(badge().text()).toBe('US PG-13');
    expect(badge().attributes('aria-label')).toBe(
      'Classificação indicativa (Estados Unidos): PG-13. Pode não ser adequado para menores de 13 anos',
    );
    expect(
      badge()
        .classes()
        .some((name) => name.startsWith('bg-')),
    ).toBe(false);
  });

  it('shows the code alone when it does not know what it means', async () => {
    i18n.global.locale.value = 'en';

    await mountBadge({ country: 'PT', code: 'M/12' }, 'PT');

    expect(badge().text()).toBe('M/12');
    expect(badge().attributes('aria-label')).toBe('Age rating: M/12');
  });

  it('shows what it means on keyboard focus too', async () => {
    i18n.global.locale.value = 'en';
    await mountBadge({ country: 'US', code: 'TV-MA' }, 'US');

    await badge().trigger('focus');
    await flushPromises();

    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      'Age rating: TV-MA. Adults only',
    );
  });
});
