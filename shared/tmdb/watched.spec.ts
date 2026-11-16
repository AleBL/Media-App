// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { TmdbError, type TmdbClient, type UserList } from './client';
import {
  createWatched,
  MAX_LIST_PAGES,
  memoryCache,
  userAccess,
  WATCHED_MARKER,
  type UserAccess,
} from './watched';

const ACCESS: UserAccess = {
  sessionId: 'b'.repeat(40),
  accessToken: 'u.s.r',
  accountObjectId: '5f0c4a1b2c3d4e5f6a7b8c9d',
};
const MATRIX = { type: 'movie', id: 603 } as const;
const WATCHED: UserList = {
  id: 77,
  name: 'Assistidos',
  description: `Media App (${WATCHED_MARKER})`,
};
const OTHER: UserList = { id: 5, name: 'Noir', description: 'Old films' };

/** A TMDB where the user has these lists, one page of them each. */
function setup(pages: UserList[][] = [[OTHER]]) {
  const tmdb = {
    userLists: vi.fn<TmdbClient['userLists']>(
      async (_token, _account, page) => ({
        lists: pages[page - 1] ?? [],
        totalPages: pages.length,
      }),
    ),
    createList: vi.fn<TmdbClient['createList']>(async () => 88),
    listItemStatus: vi.fn<TmdbClient['listItemStatus']>(async () => true),
    addToList: vi.fn<TmdbClient['addToList']>(async () => {}),
    removeFromList: vi.fn<TmdbClient['removeFromList']>(async () => {}),
    listItems: vi.fn<TmdbClient['listItems']>(async (_token, _id, page) => ({
      page,
      results: [{ id: 603, media_type: 'movie', watchedAt: '2026-11-16' }],
      totalPages: 1,
      totalResults: 1,
    })),
  };
  const cacheFor = memoryCache();

  return {
    tmdb,
    watched: createWatched(tmdb),
    cache: cacheFor(ACCESS),
  };
}

const mark = (value: boolean) => ({
  ...MATRIX,
  value,
  date: '2026-11-16',
  language: 'pt-BR',
});

describe('watched titles', () => {
  describe('the access they need', () => {
    it('is the access token of the user, from the v4 login', () => {
      expect(userAccess(ACCESS)).toEqual(ACCESS);
    });

    it.each([
      ['nobody signed in', null, 'signed-out'],
      [
        'someone signed in before the v4 login, or with a key',
        { sessionId: 'b'.repeat(40) },
        'sign-in-again',
      ],
    ] as const)('is missing with %s', (_case, access, code) => {
      expect(() => userAccess(access)).toThrow(
        expect.objectContaining({ code }),
      );
    });
  });

  it('finds the list by what its description says, on any page of the lists', async () => {
    const { watched, tmdb, cache } = setup([[OTHER], [OTHER, WATCHED]]);

    await expect(watched.state(ACCESS, cache, MATRIX)).resolves.toBe(true);

    expect(tmdb.userLists).toHaveBeenCalledTimes(2);
    expect(tmdb.userLists).toHaveBeenCalledWith(
      ACCESS.accessToken,
      ACCESS.accountObjectId,
      2,
    );
    expect(tmdb.listItemStatus).toHaveBeenCalledWith(
      ACCESS.accessToken,
      WATCHED.id,
      MATRIX,
    );
  });

  it('looks for it once, then keeps its id', async () => {
    const { watched, tmdb, cache } = setup([[WATCHED]]);

    await watched.state(ACCESS, cache, MATRIX);
    await watched.state(ACCESS, cache, { type: 'tv', id: 1396 });

    expect(tmdb.userLists).toHaveBeenCalledOnce();
    expect(cache.get()).toBe(WATCHED.id);
  });

  it(`looks through ${MAX_LIST_PAGES} pages of lists at most`, async () => {
    const { watched, tmdb, cache } = setup(
      Array.from({ length: MAX_LIST_PAGES + 3 }, () => [OTHER]),
    );

    await watched.state(ACCESS, cache, MATRIX);

    expect(tmdb.userLists).toHaveBeenCalledTimes(MAX_LIST_PAGES);
  });

  it('says nothing was watched while there is no list, and makes none', async () => {
    const { watched, tmdb, cache } = setup();

    await expect(watched.state(ACCESS, cache, MATRIX)).resolves.toBe(false);
    await expect(
      watched.list(ACCESS, cache, { page: 2, language: 'en' }),
    ).resolves.toEqual({
      page: 2,
      results: [],
      totalPages: 0,
      totalResults: 0,
    });
    await watched.mark(ACCESS, cache, mark(false));

    expect(tmdb.createList).not.toHaveBeenCalled();
    expect(tmdb.removeFromList).not.toHaveBeenCalled();
  });

  it('makes the list, private and named in the language of the app, with the first title marked', async () => {
    const { watched, tmdb, cache } = setup();

    await watched.mark(ACCESS, cache, mark(true));

    expect(tmdb.createList).toHaveBeenCalledExactlyOnceWith(
      ACCESS.accessToken,
      {
        name: 'Assistidos',
        description: expect.stringContaining(WATCHED_MARKER),
        language: 'pt-BR',
      },
    );
    // with the day in the comment
    expect(tmdb.addToList).toHaveBeenCalledExactlyOnceWith(
      ACCESS.accessToken,
      88,
      MATRIX,
      '2026-11-16',
    );
    expect(cache.get()).toBe(88);
  });

  it('names the list in English in a language it has no name in', async () => {
    const { watched, tmdb, cache } = setup();

    await watched.mark(ACCESS, cache, { ...mark(true), language: 'fr' });

    expect(tmdb.createList.mock.calls[0][1].name).toBe('Watched');
  });

  it('takes a title out of the list', async () => {
    const { watched, tmdb, cache } = setup([[WATCHED]]);

    await watched.mark(ACCESS, cache, mark(false));

    expect(tmdb.removeFromList).toHaveBeenCalledExactlyOnceWith(
      ACCESS.accessToken,
      WATCHED.id,
      MATRIX,
    );
  });

  it('reads a page of the list', async () => {
    const { watched, tmdb, cache } = setup([[WATCHED]]);

    await expect(
      watched.list(ACCESS, cache, { page: 1, language: 'es' }),
    ).resolves.toMatchObject({ results: [{ watchedAt: '2026-11-16' }] });
    expect(tmdb.listItems).toHaveBeenCalledWith(
      ACCESS.accessToken,
      WATCHED.id,
      1,
      'es',
    );
  });

  it('finds the list again when the one it kept was deleted on the TMDB website', async () => {
    const { watched, tmdb, cache } = setup([[]]);
    cache.set(13);
    tmdb.addToList.mockRejectedValueOnce(new TmdbError('not-found', 404));

    await watched.mark(ACCESS, cache, mark(true));

    expect(tmdb.addToList.mock.calls.map(([, id]) => id)).toEqual([13, 88]);
    expect(cache.get()).toBe(88);
  });

  it('asks to sign in again when TMDB no longer takes the access token', async () => {
    const { watched, tmdb, cache } = setup([[WATCHED]]);
    tmdb.listItemStatus.mockRejectedValue(
      new TmdbError('unauthorized', 401, 'Invalid token', 33),
    );

    await expect(watched.state(ACCESS, cache, MATRIX)).rejects.toMatchObject({
      code: 'sign-in-again',
    });
  });

  it('keeps the id of the list of each account apart', () => {
    const cacheFor = memoryCache();

    cacheFor(ACCESS).set(77);

    expect(cacheFor(ACCESS).get()).toBe(77);
    expect(
      cacheFor({ ...ACCESS, accountObjectId: 'someone-else' }).get(),
    ).toBeUndefined();
  });
});
