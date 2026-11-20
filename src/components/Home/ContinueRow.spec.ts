import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import i18n from '@/plugins/i18n';
import appRouter from '@/router';
import ContinueRow from '@/components/Home/ContinueRow.vue';
import { useSessionStore } from '@/stores/session';
import { useToastsStore } from '@/stores/toasts';
import { BREAKING_BAD, installFakeApi, SIGNED_IN } from '@/test/fakeApi';

describe('ContinueRow', () => {
  let api: ReturnType<typeof installFakeApi>;
  let pinia: Pinia;
  let router: Router;
  let wrapper: VueWrapper;

  async function mountRow() {
    wrapper = mount(ContinueRow, {
      global: { plugins: [pinia, i18n, router] },
    });
    await flushPromises();
  }

  const cards = () => wrapper.findAll('li');
  const saved = () => api.watched.saveProgress.mock.lastCall?.[0].seasons;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 20, 12));
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    api.tmdb.details.mockResolvedValue({ ok: true, data: BREAKING_BAD });
    api.watched.progress.mockResolvedValue({
      ok: true,
      data: [{ id: 1396, seasons: { 1: [1] }, changedAt: '2008-01-21' }],
    });
    pinia = createPinia();
    setActivePinia(pinia);
    router = createRouter({
      history: createMemoryHistory(),
      routes: appRouter.options.routes,
    });
  });

  afterEach(() => {
    wrapper.unmount();
    vi.useRealTimers();
    delete window.api;
  });

  it('shows nothing to whoever is not signed in', async () => {
    await mountRow();

    expect(wrapper.html()).not.toContain('section');
    expect(api.watched.progress).not.toHaveBeenCalled();
  });

  it('shows nothing to whoever is watching no show', async () => {
    useSessionStore().state = SIGNED_IN;
    api.watched.progress.mockResolvedValue({ ok: true, data: [] });

    await mountRow();

    expect(wrapper.find('section').exists()).toBe(false);
  });

  it('shows each show with its next episode, leading to its season', async () => {
    useSessionStore().state = SIGNED_IN;

    await mountRow();

    expect(wrapper.get('h2').text()).toBe('Continue watching');
    const [card] = cards();
    expect(card.get('h3 a').text()).toBe('Breaking Bad');
    expect(card.get('h3 a').attributes('href')).toBe('/tv/1396/season/1');
    expect(card.text()).toContain("S1 E2 · Cat's in the Bag...");
    expect(card.text()).toContain('1 of 20 episodes watched');
    // it came out after the last change
    expect(card.text()).toContain('New');
  });

  it('marks the next episode watched from the card, which goes on to the one after', async () => {
    useSessionStore().state = SIGNED_IN;
    await mountRow();

    await wrapper
      .get('button[aria-label="Mark S1 E2 of Breaking Bad as watched"]')
      .trigger('click');
    await flushPromises();

    expect(saved()).toEqual({ 1: [1, 2] });
    expect(cards()[0].text()).toContain('S1 E3');

    const [notice] = useToastsStore().toasts;
    expect(notice.message).toBe('S1 E2 of Breaking Bad marked as watched.');

    notice.action!.run();
    await flushPromises();

    expect(saved()).toEqual({ 1: [1] });
    expect(cards()[0].text()).toContain('S1 E2');
  });

  it('marks the show watched with its last episode out, and leaves the row', async () => {
    useSessionStore().state = SIGNED_IN;
    const first = Array.from({ length: 7 }, (_, index) => index + 1);
    const second = Array.from({ length: 12 }, (_, index) => index + 1);
    api.watched.progress.mockResolvedValue({
      ok: true,
      data: [
        { id: 1396, seasons: { 1: first, 2: second }, changedAt: '2026-11-19' },
      ],
    });
    await mountRow();

    await wrapper
      .get('button[aria-label="Mark S2 E13 of Breaking Bad as watched"]')
      .trigger('click');
    await flushPromises();

    expect(api.watched.state).toHaveBeenCalledWith({ type: 'tv', id: 1396 });
    expect(api.watched.mark).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tv', id: 1396, value: true }),
    );
    expect(wrapper.find('section').exists()).toBe(false);
  });

  it('offers to try again when the shows could not be asked', async () => {
    useSessionStore().state = SIGNED_IN;
    api.tmdb.details.mockResolvedValue({
      ok: false,
      error: { code: 'network' },
    });

    await mountRow();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Your shows in progress could not be loaded.',
    );

    api.tmdb.details.mockResolvedValue({ ok: true, data: BREAKING_BAD });
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(cards()).toHaveLength(1);
  });
});
