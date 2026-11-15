import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSessionStore } from '@/stores/session';
import {
  ANONYMOUS,
  installFakeApi,
  PENDING,
  SIGNED_IN,
  signedInOnDesktop,
} from '@/test/fakeApi';

describe('session store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof useSessionStore>;

  beforeEach(() => {
    api = installFakeApi();
    setActivePinia(createPinia());
    store = useSessionStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('has nobody signed in before it is loaded', () => {
    expect(store.state).toEqual(ANONYMOUS);
    expect(store.account).toBeNull();
    expect(store.busy).toBe(false);
  });

  it('reads who is signed in', async () => {
    api.auth.getSession.mockResolvedValue(SIGNED_IN);

    await store.load();

    expect(store.account).toEqual({
      id: 7,
      username: 'ada',
      name: 'Ada Lovelace',
    });
  });

  it('follows the changes that happen outside the app, such as the approval', async () => {
    await store.load();
    const listener = api.auth.onChange.mock.calls[0][0];

    listener(SIGNED_IN);
    expect(store.state).toEqual(SIGNED_IN);

    listener({ status: 'error', reason: 'timeout' });
    expect(store.account).toBeNull();
    expect(store.state).toEqual({ status: 'error', reason: 'timeout' });
  });

  it('listens once, however often it is loaded', async () => {
    await store.load();
    await store.load();

    expect(api.auth.onChange).toHaveBeenCalledTimes(1);
    expect(api.auth.getSession).toHaveBeenCalledTimes(2);
  });

  it('starts a login with the language for the result page', async () => {
    const login = store.login('pt-BR');

    expect(store.busy).toBe(true);
    await login;

    expect(api.auth.login).toHaveBeenCalledWith('pt-BR');
    expect(store.state).toEqual(PENDING);
    expect(store.busy).toBe(false);
  });

  it('signs in when the approval is confirmed by hand', async () => {
    await store.login('en');

    await store.confirm();

    expect(store.state).toEqual(SIGNED_IN);
    expect(store.notConfirmed).toBe(false);
  });

  it('tells when TMDB has not seen the approval yet', async () => {
    api.auth.confirmManual.mockResolvedValue(PENDING);
    await store.login('en');

    await store.confirm();

    expect(store.state).toEqual(PENDING);
    expect(store.notConfirmed).toBe(true);
  });

  it('drops that warning once the login is no longer waiting', async () => {
    api.auth.confirmManual.mockResolvedValue(PENDING);
    await store.load();
    await store.login('en');
    await store.confirm();

    api.auth.onChange.mock.calls[0][0](SIGNED_IN);

    expect(store.notConfirmed).toBe(false);
  });

  it('gives up a login', async () => {
    await store.login('en');

    await store.cancel();

    expect(api.auth.cancelLogin).toHaveBeenCalled();
    expect(store.state).toEqual(ANONYMOUS);
  });

  it('signs out', async () => {
    api.auth.getSession.mockResolvedValue(SIGNED_IN);
    await store.load();

    await store.logout();

    expect(api.auth.logout).toHaveBeenCalled();
    expect(store.account).toBeNull();
  });

  it('keeps the session when the user agrees to', async () => {
    const kept = signedInOnDesktop('unencrypted');
    api.auth.getSession.mockResolvedValue(signedInOnDesktop('ask'));
    api.auth.remember.mockResolvedValue(kept);
    await store.load();

    await store.remember();

    expect(api.auth.remember).toHaveBeenCalled();
    expect(store.state).toEqual(kept);
  });

  it('is not left busy by a request that failed', async () => {
    api.auth.login.mockRejectedValue(new Error('the main process is gone'));

    await expect(store.login('en')).rejects.toThrow('the main process is gone');

    expect(store.busy).toBe(false);
    expect(store.state).toEqual(ANONYMOUS);
  });
});
