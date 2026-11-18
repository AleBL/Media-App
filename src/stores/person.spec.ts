import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { PersonDetails, Result } from '@shared/api';
import i18n from '@/plugins/i18n';
import { usePersonStore } from '@/stores/person';
import { installFakeApi, KEANU } from '@/test/fakeApi';

describe('person store', () => {
  let api: ReturnType<typeof installFakeApi>;
  let store: ReturnType<typeof usePersonStore>;

  beforeEach(() => {
    i18n.global.locale.value = 'en';
    api = installFakeApi();
    setActivePinia(createPinia());
    store = usePersonStore();
  });

  afterEach(() => {
    delete window.api;
  });

  it('asks for the person in the language of the app', async () => {
    i18n.global.locale.value = 'es';

    await store.load(6384);

    expect(api.tmdb.person).toHaveBeenCalledWith({ id: 6384, language: 'es' });
    expect(store.person).toEqual(KEANU);
    expect(store.loading).toBe(false);
  });

  it('keeps the failure, and nothing of the person', async () => {
    await store.load(6384);
    api.tmdb.person.mockResolvedValue({
      ok: false,
      error: { code: 'not-found', status: 404 },
    });

    await store.load(999);

    expect(store.person).toBeNull();
    expect(store.error).toEqual({ code: 'not-found', status: 404 });
  });

  it('turns a call that throws into a failure', async () => {
    api.tmdb.person.mockRejectedValue(new Error('the preload script died'));

    await store.load(6384);

    expect(store.error).toEqual({
      code: 'server',
      message: 'the preload script died',
    });
  });

  it('keeps the person on the screen while asking again, and shows no one else meanwhile', async () => {
    await store.load(6384);
    api.tmdb.person.mockReturnValue(new Promise(() => {}));

    void store.load(6384);
    expect(store.person).toEqual(KEANU);
    expect(store.loading).toBe(true);

    void store.load(525);
    expect(store.person).toBeNull();
  });

  it('ignores the answer about someone the user already left', async () => {
    let answerFirst: (answer: Result<PersonDetails>) => void = () => {};
    api.tmdb.person.mockReturnValueOnce(
      new Promise((resolve) => {
        answerFirst = resolve;
      }),
    );

    const first = store.load(6384);
    await store.load(525);
    answerFirst({ ok: true, data: KEANU });
    await first;

    expect(store.person?.id).toBe(525);
  });
});
