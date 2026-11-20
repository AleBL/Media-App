// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { TmdbError, type TmdbClient, type UserList } from './client';
import {
  createWatched,
  EPISODES_MARKER,
  MAX_LIST_PAGES,
  MAX_LIST_TRIES,
  MAX_PROGRESS_PAGES,
  createMemoryListCache,
  requireUserAccess,
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
  description: `MoviLedger (${WATCHED_MARKER})`,
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
    updateList: vi.fn<TmdbClient['updateList']>(async () => {}),
    listItemStatus: vi.fn<TmdbClient['listItemStatus']>(async () => true),
    addToList: vi.fn<TmdbClient['addToList']>(async () => {}),
    addItem: vi.fn<TmdbClient['addItem']>(async () => {}),
    commentOn: vi.fn<TmdbClient['commentOn']>(async () => {}),
    listComments: vi.fn<TmdbClient['listComments']>(async () => ({
      items: [],
      totalPages: 1,
    })),
    removeFromList: vi.fn<TmdbClient['removeFromList']>(async () => {}),
    listItems: vi.fn<TmdbClient['listItems']>(async (_token, _id, page) => ({
      page,
      results: [{ id: 603, media_type: 'movie', watchedAt: '2026-11-16' }],
      totalPages: 1,
      totalResults: 1,
    })),
  };
  const cacheFor = createMemoryListCache();

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
      expect(requireUserAccess(ACCESS)).toEqual(ACCESS);
    });

    it.each([
      ['nobody signed in', null, 'signed-out'],
      [
        'someone signed in before the v4 login, or with a key',
        { sessionId: 'b'.repeat(40) },
        'sign-in-again',
      ],
    ] as const)('is missing with %s', (_case, access, code) => {
      expect(() => requireUserAccess(access)).toThrow(
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
    // made private (TMDB makes it public) only with the first title in it
    expect(tmdb.updateList).toHaveBeenCalledExactlyOnceWith(
      ACCESS.accessToken,
      88,
      {
        name: 'Assistidos',
        description: expect.stringContaining(WATCHED_MARKER),
      },
    );
    expect(tmdb.addToList.mock.invocationCallOrder[0]).toBeLessThan(
      tmdb.updateList.mock.invocationCallOrder[0],
    );
    expect(cache.get()).toBe(88);
  });

  it('keeps the first title when TMDB will not make the list private', async () => {
    const { watched, tmdb, cache } = setup();
    tmdb.updateList.mockRejectedValue(new TmdbError('server', 500));

    await expect(
      watched.mark(ACCESS, cache, mark(true)),
    ).resolves.toBeUndefined();
  });

  it('changes a list it found, or kept, as it is', async () => {
    const { watched, tmdb, cache } = setup([[WATCHED]]);

    await watched.mark(ACCESS, cache, mark(true));
    await watched.mark(ACCESS, cache, mark(true));

    expect(tmdb.updateList).not.toHaveBeenCalled();
  });

  it('goes past every deleted list that TMDB still lists', async () => {
    const OLDER = { ...WATCHED, id: 66 };
    const { watched, tmdb, cache } = setup([[OLDER, WATCHED]]);
    tmdb.addToList.mockImplementation(async (_token, id) => {
      if (id !== 88) {
        throw new TmdbError('not-found', 404);
      }
    });

    await watched.mark(ACCESS, cache, mark(true));

    expect(tmdb.addToList.mock.calls.map(([, id]) => id)).toEqual([66, 77, 88]);
    expect(tmdb.createList).toHaveBeenCalledOnce();
  });

  it('gives up after a few lists that are all gone', async () => {
    const lists = Array.from({ length: MAX_LIST_TRIES + 2 }, (_, i) => ({
      ...WATCHED,
      id: 100 + i,
    }));
    const { watched, tmdb, cache } = setup([lists]);
    tmdb.addToList.mockRejectedValue(new TmdbError('not-found', 404));

    await expect(watched.mark(ACCESS, cache, mark(true))).rejects.toMatchObject(
      { code: 'not-found' },
    );
    expect(tmdb.addToList).toHaveBeenCalledTimes(MAX_LIST_TRIES);
  });

  it('does not make one list after another when the new one fails', async () => {
    const { watched, tmdb, cache } = setup();
    tmdb.addToList.mockRejectedValue(new TmdbError('not-found', 404));

    await expect(watched.mark(ACCESS, cache, mark(true))).rejects.toMatchObject(
      { code: 'not-found' },
    );
    expect(tmdb.createList).toHaveBeenCalledOnce();
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

  it('leaves out a deleted list that TMDB still lists for a while', async () => {
    // deleted on the website, and still among the lists of the user
    const { watched, tmdb, cache } = setup([[WATCHED]]);
    cache.set(WATCHED.id);
    tmdb.addToList.mockRejectedValueOnce(new TmdbError('not-found', 404));

    await watched.mark(ACCESS, cache, mark(true));

    // made again at the first click, not at the second
    expect(tmdb.createList).toHaveBeenCalledOnce();
    expect(tmdb.addToList.mock.calls.map(([, id]) => id)).toEqual([
      WATCHED.id,
      88,
    ]);
    expect(cache.get()).toBe(88);
  });

  it('looks again when the list it just found is gone, without a list it kept', async () => {
    const { watched, tmdb, cache } = setup([[WATCHED]]);
    tmdb.listItems.mockRejectedValueOnce(new TmdbError('not-found', 404));

    // reading: nothing is made for it
    await expect(
      watched.list(ACCESS, cache, { page: 1, language: 'en' }),
    ).resolves.toMatchObject({ results: [], totalResults: 0 });
    expect(tmdb.createList).not.toHaveBeenCalled();
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

  describe('the episodes watched', () => {
    const EPISODES: UserList = {
      id: 99,
      name: 'MoviLedger: episódios',
      description: `MoviLedger (${EPISODES_MARKER})`,
    };
    const BREAKING_BAD = { type: 'tv', id: 1396 } as const;
    const save = (seasons: Record<number, number[]>) => ({
      id: 1396,
      seasons,
      date: '2026-11-20',
      language: 'pt-BR',
    });

    it('come from their own list, not the one of the watched titles', async () => {
      const { watched, tmdb, cache } = setup([[WATCHED, EPISODES]]);
      tmdb.listComments.mockResolvedValue({
        items: [
          { ...BREAKING_BAD, comment: '2026-11-20;1:1-7;2:1' },
          { type: 'movie', id: 603, comment: '2026-11-16;1:1' },
          { type: 'tv', id: 1399, comment: 'a note of the user' },
          { type: 'tv', id: 1400 },
        ],
        totalPages: 1,
      });

      await expect(watched.progress(ACCESS, cache)).resolves.toEqual([
        {
          id: 1396,
          seasons: { 1: [1, 2, 3, 4, 5, 6, 7], 2: [1] },
          changedAt: '2026-11-20',
        },
      ]);
      expect(tmdb.listComments).toHaveBeenCalledExactlyOnceWith(
        ACCESS.accessToken,
        EPISODES.id,
        1,
      );
      expect(cache.get()).toBe(EPISODES.id);
    });

    it(`are read from every page, ${MAX_PROGRESS_PAGES} at most, each show once`, async () => {
      const { watched, tmdb, cache } = setup([[EPISODES]]);
      tmdb.listComments.mockImplementation(async (_token, _id, page) => ({
        items: [
          { type: 'tv', id: page === 3 ? 7 : page, comment: '2026-11-20;1:1' },
        ],
        totalPages: MAX_PROGRESS_PAGES + 5,
      }));

      const shows = await watched.progress(ACCESS, cache);

      expect(tmdb.listComments).toHaveBeenCalledTimes(MAX_PROGRESS_PAGES);
      expect(shows.map(({ id }) => id)).toHaveLength(MAX_PROGRESS_PAGES - 1);
    });

    it('are none while there is no list, and none is made for reading', async () => {
      const { watched, tmdb, cache } = setup([[WATCHED]]);

      await expect(watched.progress(ACCESS, cache)).resolves.toEqual([]);
      expect(tmdb.createList).not.toHaveBeenCalled();
    });

    it('make their list, private and named in the language of the app, with the first episode', async () => {
      const { watched, tmdb, cache } = setup([[WATCHED]]);
      tmdb.listItemStatus.mockResolvedValue(false);

      await watched.saveProgress(ACCESS, cache, save({ 1: [1] }));

      const list = {
        name: 'MoviLedger: episódios',
        description: `MoviLedger (${EPISODES_MARKER})`,
      };

      expect(tmdb.createList).toHaveBeenCalledExactlyOnceWith(
        ACCESS.accessToken,
        { ...list, language: 'pt-BR' },
      );
      expect(tmdb.addItem).toHaveBeenCalledExactlyOnceWith(
        ACCESS.accessToken,
        88,
        BREAKING_BAD,
      );
      expect(tmdb.commentOn).toHaveBeenCalledExactlyOnceWith(
        ACCESS.accessToken,
        88,
        BREAKING_BAD,
        '2026-11-20;1:1',
      );
      expect(tmdb.updateList).toHaveBeenCalledExactlyOnceWith(
        ACCESS.accessToken,
        88,
        list,
      );
    });

    it('of a show already in the list change its comment alone', async () => {
      const { watched, tmdb, cache } = setup([[EPISODES]]);

      await watched.saveProgress(ACCESS, cache, save({ 2: [3, 1, 2], 1: [1] }));

      expect(tmdb.addItem).not.toHaveBeenCalled();
      expect(tmdb.commentOn).toHaveBeenCalledExactlyOnceWith(
        ACCESS.accessToken,
        EPISODES.id,
        BREAKING_BAD,
        '2026-11-20;1:1;2:1-3',
      );
    });

    it('fail when TMDB does not take the comment', async () => {
      const { watched, tmdb, cache } = setup([[EPISODES]]);
      tmdb.commentOn.mockRejectedValue(new TmdbError('server', 200));

      await expect(
        watched.saveProgress(ACCESS, cache, save({ 1: [1] })),
      ).rejects.toMatchObject({ code: 'server' });
    });

    it('take the show out when none is left', async () => {
      const { watched, tmdb, cache } = setup([[EPISODES]]);

      await watched.saveProgress(ACCESS, cache, save({ 1: [] }));

      expect(tmdb.removeFromList).toHaveBeenCalledExactlyOnceWith(
        ACCESS.accessToken,
        EPISODES.id,
        BREAKING_BAD,
      );
      expect(tmdb.commentOn).not.toHaveBeenCalled();
    });

    it('leave alone a show that is not in the list, or a list that is not there', async () => {
      const listed = setup([[EPISODES]]);
      listed.tmdb.listItemStatus.mockResolvedValue(false);
      const none = setup([[WATCHED]]);

      await listed.watched.saveProgress(ACCESS, listed.cache, save({}));
      await none.watched.saveProgress(ACCESS, none.cache, save({}));

      expect(listed.tmdb.removeFromList).not.toHaveBeenCalled();
      expect(none.tmdb.createList).not.toHaveBeenCalled();
      expect(none.tmdb.removeFromList).not.toHaveBeenCalled();
    });
  });

  it('keeps the id of the list of each account apart', () => {
    const cacheFor = createMemoryListCache();

    cacheFor(ACCESS).set(77);

    expect(cacheFor(ACCESS).get()).toBe(77);
    expect(
      cacheFor({ ...ACCESS, accountObjectId: 'someone-else' }).get(),
    ).toBeUndefined();
  });
});
