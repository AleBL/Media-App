import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import type { LoginFailure } from '@shared/api';
import i18n from '@/plugins/i18n';
import AccountPage from '@/views/AccountPage.vue';
import { useSessionStore } from '@/stores/session';
import { installFakeApi, PENDING, SIGNED_IN } from '@/test/fakeApi';

describe('AccountPage', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useSessionStore>;
  let wrapper: VueWrapper;

  async function mountPage() {
    wrapper = mount(AccountPage, {
      global: { plugins: [i18n, [PrimeVue, { unstyled: true }]] },
    });
    await flushPromises();
  }

  const button = (label: string) =>
    wrapper.findAll('button').find((found) => found.text() === label);

  async function click(label: string) {
    await button(label)!.trigger('click');
    await flushPromises();
  }

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    setActivePinia(createPinia());
    store = useSessionStore();
  });

  afterEach(() => {
    wrapper.unmount();
    delete window.api;
  });

  describe('with nobody signed in', () => {
    it('explains that signing in is optional and where it happens', async () => {
      await mountPage();

      expect(wrapper.get('h1').text()).toBe('Account');
      expect(wrapper.text()).toContain('the search works without it');
      expect(wrapper.text()).toContain('The app never sees your password');
      expect(button('Sign in with TMDB')).toBeDefined();
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });

    it('starts the login, with the result page in the language of the app', async () => {
      i18n.global.locale.value = 'pt-BR';
      await mountPage();

      await click('Entrar com TMDB');

      expect(api.auth.login).toHaveBeenCalledExactlyOnceWith('pt-BR');
      expect(wrapper.get('[role="status"]').text()).toContain(
        'Aprove o acesso na página do TMDB',
      );
    });
  });

  describe('while waiting for the approval', () => {
    beforeEach(() => {
      store.state = PENDING;
    });

    it('offers to confirm by hand and to give up', async () => {
      await mountPage();

      expect(wrapper.get('[role="status"]').text()).toContain(
        'Approve the access on the TMDB page',
      );
      expect(button('I already approved in the browser')).toBeDefined();
      expect(button('Cancel')).toBeDefined();
      expect(button('Sign in with TMDB')).toBeUndefined();
    });

    it('shows the address of the page, for a browser that did not open', async () => {
      await mountPage();

      const address = wrapper.get<HTMLInputElement>('#authorize-url');

      expect(address.element.value).toBe(
        PENDING.status === 'pending' ? PENDING.authorizeUrl : '',
      );
      expect(address.attributes('readonly')).toBeDefined();
      expect(wrapper.text()).toContain('If the page did not open');
    });

    it('signs in when the approval is confirmed', async () => {
      await mountPage();

      await click('I already approved in the browser');

      expect(api.auth.confirmManual).toHaveBeenCalled();
      expect(wrapper.text()).toContain('Signed in as Ada Lovelace');
    });

    it('says so when TMDB has not seen the approval yet', async () => {
      api.auth.confirmManual.mockResolvedValue(PENDING);
      await mountPage();

      await click('I already approved in the browser');

      expect(wrapper.get('[role="alert"]').text()).toContain(
        'TMDB has not confirmed the approval yet',
      );
      expect(button('I already approved in the browser')).toBeDefined();
    });

    it('gives up', async () => {
      await mountPage();

      await click('Cancel');

      expect(api.auth.cancelLogin).toHaveBeenCalled();
      expect(button('Sign in with TMDB')).toBeDefined();
    });

    it('lets the user give up while TMDB is being asked', async () => {
      api.auth.confirmManual.mockReturnValue(new Promise(() => {}));
      await mountPage();

      await click('I already approved in the browser');

      expect(
        button('I already approved in the browser')!.attributes('disabled'),
      ).toBeDefined();
      expect(button('Cancel')!.attributes('disabled')).toBeUndefined();
    });

    it('follows the approval that arrives from the browser', async () => {
      await store.load();
      await mountPage();

      api.auth.onChange.mock.calls[0][0](SIGNED_IN);
      await flushPromises();

      expect(wrapper.text()).toContain('Signed in as Ada Lovelace');
    });
  });

  describe('after a login that failed', () => {
    it.each<[LoginFailure, string]>([
      ['denied', 'The access was not approved on the TMDB website.'],
      ['timeout', 'The approval took too long.'],
      ['network', 'TMDB could not be reached.'],
      ['unavailable', 'Signing in is unavailable at the moment.'],
    ])(
      'explains a %s failure and offers to try again',
      async (reason, text) => {
        store.state = { status: 'error', reason };

        await mountPage();

        expect(wrapper.get('[role="alert"]').text()).toContain(text);

        await click('Try again');

        expect(api.auth.login).toHaveBeenCalledExactlyOnceWith('en');
        expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      },
    );
  });

  describe('with someone signed in', () => {
    it('shows who, by the username when TMDB has no name', async () => {
      store.state = {
        status: 'authenticated',
        account: { id: 7, username: 'ada' },
      };

      await mountPage();

      expect(wrapper.text()).toContain('Signed in as ada');
      expect(button('Sign in with TMDB')).toBeUndefined();
    });

    it('signs out', async () => {
      store.state = SIGNED_IN;
      await mountPage();

      await click('Sign out');

      expect(api.auth.logout).toHaveBeenCalled();
      expect(button('Sign in with TMDB')).toBeDefined();
    });
  });

  it('has no sign in on the web version yet', async () => {
    api.platform = 'web';

    await mountPage();

    expect(wrapper.text()).toContain('not available in the web version yet');
    expect(wrapper.findAll('button')).toHaveLength(0);
  });
});
