import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import i18n from '@/plugins/i18n';
import TrailerDialog from '@/components/Details/TrailerDialog.vue';

describe('TrailerDialog', () => {
  let wrapper: VueWrapper;

  async function mountDialog(videoKey = 'vKQi3bBA1y8') {
    wrapper = mount(TrailerDialog, {
      props: { videoKey, title: 'Matrix' },
      attachTo: document.body,
      global: { plugins: [i18n] },
    });
    await flushPromises();
  }

  // The dialog opens in a layer of its own, at the end of body.
  const dialog = () => document.body.querySelector('[role="dialog"]');
  const player = () => document.body.querySelector('iframe');
  const trigger = () => wrapper.get('button');

  async function openIt() {
    await trigger().trigger('click');
    await flushPromises();
  }

  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('is a button until asked, with no player on the page', async () => {
    await mountDialog();

    expect(trigger().text()).toBe('Watch the trailer');
    expect(trigger().attributes('aria-haspopup')).toBe('dialog');
    expect(dialog()).toBeNull();
    expect(player()).toBeNull();
  });

  it('plays the trailer over the page, from YouTube without its cookies', async () => {
    await mountDialog();
    await openIt();

    const titleId = dialog()!.getAttribute('aria-labelledby')!;
    expect(document.getElementById(titleId)!.textContent).toContain(
      'Trailer: Matrix',
    );
    expect(player()!.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/vKQi3bBA1y8?autoplay=1&rel=0',
    );
    expect(player()!.getAttribute('title')).toBe('Trailer: Matrix');
    expect(player()!.getAttribute('referrerpolicy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(player()!.hasAttribute('allowfullscreen')).toBe(true);
  });

  it('offers to watch it on YouTube instead, in the browser', async () => {
    await mountDialog();
    await openIt();

    const link = Array.from(dialog()!.querySelectorAll('a')).find(
      (found) => found.textContent?.trim() === 'Open on YouTube',
    )!;

    expect(link.getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=vKQi3bBA1y8',
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('stops the video when it closes: the player leaves the page', async () => {
    await mountDialog();
    await openIt();

    dialog()!
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Close the trailer"]',
      )!
      .click();
    await flushPromises();

    expect(dialog()).toBeNull();
    expect(player()).toBeNull();
    expect(trigger().attributes('aria-expanded')).toBe('false');
  });

  it('closes with Esc too', async () => {
    await mountDialog();
    await openIt();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await flushPromises();

    expect(player()).toBeNull();
  });

  it('keeps an odd key inside the address of the player', async () => {
    await mountDialog('../watch?v=x');
    await openIt();

    expect(player()!.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/..%2Fwatch%3Fv%3Dx?autoplay=1&rel=0',
    );
  });
});
