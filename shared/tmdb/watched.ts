import type {
  MediaItem,
  Paged,
  ProgressRequest,
  ShowProgress,
  TitleRequest,
  WatchedListRequest,
  WatchedRequest,
} from '../api';
import { TmdbError, type Access, type TmdbClient } from './client';
import { decodeProgress, encodeProgress, encodeSeasons } from './episodes';

// TMDB has no "watched", so the titles go in a private v4 list of the user,
// created on the first mark and found again by its description. The date
// goes in each title's comment.
//
// The episodes watched go in a second one, of the shows that have any, each
// with its episodes in the comment (episodes.ts): the first list goes on
// meaning "watched all of it", and every show in progress is one short
// list to read.

// From the name the app had before (Media App): the lists already made at
// TMDB carry it, and a new marker would start an empty list beside them.
export const WATCHED_MARKER = 'media-app:watched';
export const EPISODES_MARKER = 'moviledger:episodes';

interface ListKind {
  /** In the description, where the list is found by. */
  marker: string;
  /** By language, for a list made by the app. */
  names: Record<string, string>;
}

const WATCHED_LIST: ListKind = {
  marker: WATCHED_MARKER,
  names: { en: 'Watched', pt: 'Assistidos', es: 'Vistos' },
};

const EPISODES_LIST: ListKind = {
  marker: EPISODES_MARKER,
  names: {
    en: 'MoviLedger: episodes',
    pt: 'MoviLedger: episódios',
    es: 'MoviLedger: episodios',
  },
};

/** How many pages of the user's lists are searched. */
export const MAX_LIST_PAGES = 5;

/** How many pages of the list of episodes are read: 500 shows. */
export const MAX_PROGRESS_PAGES = 25;

/**
 * TMDB keeps listing a deleted list for a while, so more than one found list
 * can be gone.
 */
export const MAX_LIST_TRIES = 4;

/** v4 sign-in: the lists need all of it. */
export type UserAccess = Required<Access>;

/** Remembers the list id: in memory on the desktop, in a cookie on the web. */
export interface ListCache {
  get(): number | undefined;
  set(id: number | undefined): void;
}

export function requireUserAccess(access: Access | null): UserAccess {
  if (!access) {
    throw new TmdbError('signed-out');
  }

  const { sessionId, accessToken, accountObjectId } = access;

  if (!accessToken || !accountObjectId) {
    throw new TmdbError('sign-in-again');
  }

  return { sessionId, accessToken, accountObjectId };
}

/** One cache per account, for the desktop app. */
export function createMemoryListCache() {
  const ids = new Map<string, number>();

  return (access: UserAccess): ListCache => ({
    get: () => ids.get(access.accountObjectId),
    set: (id) =>
      id === undefined
        ? ids.delete(access.accountObjectId)
        : ids.set(access.accountObjectId, id),
  });
}

const EMPTY_PAGE: Paged<MediaItem> = {
  page: 1,
  results: [],
  totalPages: 0,
  totalResults: 0,
};

type ListClient = Pick<
  TmdbClient,
  | 'userLists'
  | 'createList'
  | 'updateList'
  | 'listItemStatus'
  | 'addToList'
  | 'addItem'
  | 'commentOn'
  | 'removeFromList'
  | 'listItems'
  | 'listComments'
>;

const listInfo = (kind: ListKind, language: string) => ({
  name: kind.names[language.slice(0, 2)] ?? kind.names.en,
  description: `MoviLedger (${kind.marker})`,
});

interface WithListOptions<T> {
  /** Returned when there is no list (and none is created). */
  fallback: T;
  /** Creates the list, named in this language, when there is none. */
  createInLanguage?: string;
  /** The list of watched titles, unless it says otherwise. */
  kind?: ListKind;
}

export function createWatched(tmdb: ListClient) {
  async function findList(
    access: UserAccess,
    deletedIds: Set<number>,
    kind: ListKind,
  ) {
    for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
      const { lists, totalPages } = await tmdb.userLists(
        access.accessToken,
        access.accountObjectId,
        page,
      );
      const found = lists.find(
        (list) =>
          !deletedIds.has(list.id) && list.description.includes(kind.marker),
      );

      if (found) {
        return found.id;
      }

      if (page >= totalPages) {
        return undefined;
      }
    }

    return undefined;
  }

  async function getList(
    access: UserAccess,
    cache: ListCache,
    deletedIds: Set<number>,
    kind: ListKind,
    createInLanguage?: string,
  ): Promise<{ id: number; created: boolean } | undefined> {
    const cachedId = cache.get();

    if (cachedId !== undefined && !deletedIds.has(cachedId)) {
      return { id: cachedId, created: false };
    }

    const foundId = await findList(access, deletedIds, kind);
    const list =
      foundId !== undefined
        ? { id: foundId, created: false }
        : createInLanguage
          ? {
              id: await tmdb.createList(access.accessToken, {
                ...listInfo(kind, createInLanguage),
                language: createInLanguage,
              }),
              created: true,
            }
          : undefined;

    if (list) {
      cache.set(list.id);
    }

    return list;
  }

  /**
   * Runs `action` on the list. A list deleted on the TMDB website (which
   * TMDB still lists for a while) is skipped and the next one tried.
   */
  async function withList<T>(
    access: UserAccess,
    cache: ListCache,
    action: (listId: number) => Promise<T>,
    { fallback, createInLanguage, kind = WATCHED_LIST }: WithListOptions<T>,
  ): Promise<T> {
    const deletedIds = new Set<number>();

    for (let tries = 1; ; tries += 1) {
      const list = await getList(
        access,
        cache,
        deletedIds,
        kind,
        createInLanguage,
      );

      if (!list) {
        return fallback;
      }

      try {
        const result = await action(list.id);

        // TMDB creates lists as public. Made private only after the first
        // title: changing it right after creation made that title fail
        // (2026-11-16).
        if (list.created && createInLanguage) {
          await tmdb
            .updateList(
              access.accessToken,
              list.id,
              listInfo(kind, createInLanguage),
            )
            .catch(() => {});
        }

        return result;
      } catch (error) {
        const deleted =
          error instanceof TmdbError && error.code === 'not-found';

        if (!deleted || list.created || tries >= MAX_LIST_TRIES) {
          throw error;
        }

        deletedIds.add(list.id);
        cache.set(undefined);
      }
    }
  }

  /** A 401 here means the user revoked the app's access on the website. */
  async function mapRevokedToken<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      if (error instanceof TmdbError && error.status === 401) {
        throw new TmdbError('sign-in-again', 401);
      }

      throw error;
    }
  }

  /** Every show of the list of episodes, up to MAX_PROGRESS_PAGES pages. */
  async function readProgress(
    access: UserAccess,
    listId: number,
  ): Promise<ShowProgress[]> {
    const first = await tmdb.listComments(access.accessToken, listId, 1);
    const last = Math.min(first.totalPages, MAX_PROGRESS_PAGES);
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, last - 1) }, (_, index) =>
        tmdb.listComments(access.accessToken, listId, index + 2),
      ),
    );
    // A show can move to the next page while they are read: once each.
    const shows = new Map<number, ShowProgress>();

    for (const { type, id, comment } of [first, ...rest].flatMap(
      (page) => page.items,
    )) {
      const progress =
        type === 'tv' && !shows.has(id) ? decodeProgress(comment) : null;

      if (progress) {
        shows.set(id, { id, ...progress });
      }
    }

    return [...shows.values()];
  }

  /** In the list with its episodes in the comment, or out of it with none. */
  async function writeProgress(
    access: UserAccess,
    listId: number,
    { id, seasons, date }: ProgressRequest,
  ) {
    const show = { type: 'tv', id } as const;
    const listed = await tmdb.listItemStatus(access.accessToken, listId, show);

    if (!encodeSeasons(seasons)) {
      if (listed) {
        await tmdb.removeFromList(access.accessToken, listId, show);
      }

      return;
    }

    if (!listed) {
      await tmdb.addItem(access.accessToken, listId, show);
    }

    await tmdb.commentOn(
      access.accessToken,
      listId,
      show,
      encodeProgress(date, seasons),
    );
  }

  return {
    state: (access: UserAccess, cache: ListCache, title: TitleRequest) =>
      mapRevokedToken(() =>
        withList(
          access,
          cache,
          (listId) => tmdb.listItemStatus(access.accessToken, listId, title),
          { fallback: false },
        ),
      ),

    mark: (
      access: UserAccess,
      cache: ListCache,
      { type, id, value, date, language }: WatchedRequest,
    ) =>
      mapRevokedToken(() =>
        value
          ? withList(
              access,
              cache,
              (listId) =>
                tmdb.addToList(access.accessToken, listId, { type, id }, date),
              { fallback: undefined, createInLanguage: language },
            )
          : withList(
              access,
              cache,
              (listId) =>
                tmdb.removeFromList(access.accessToken, listId, { type, id }),
              { fallback: undefined },
            ),
      ),

    list: (
      access: UserAccess,
      cache: ListCache,
      { page, language }: WatchedListRequest,
    ) =>
      mapRevokedToken(() =>
        withList(
          access,
          cache,
          (listId) =>
            tmdb.listItems(access.accessToken, listId, page, language),
          { fallback: { ...EMPTY_PAGE, page } },
        ),
      ),

    /** `cache` remembers the list of episodes, not the watched one. */
    progress: (access: UserAccess, cache: ListCache) =>
      mapRevokedToken(() =>
        withList(access, cache, (listId) => readProgress(access, listId), {
          fallback: [] as ShowProgress[],
          kind: EPISODES_LIST,
        }),
      ),

    /** `cache` remembers the list of episodes, not the watched one. */
    saveProgress: (
      access: UserAccess,
      cache: ListCache,
      request: ProgressRequest,
    ) =>
      mapRevokedToken(() =>
        withList(
          access,
          cache,
          (listId) => writeProgress(access, listId, request),
          {
            fallback: undefined,
            kind: EPISODES_LIST,
            // Made for the first episode, never to take one out.
            ...(encodeSeasons(request.seasons)
              ? { createInLanguage: request.language }
              : {}),
          },
        ),
      ),
  };
}

export type Watched = ReturnType<typeof createWatched>;
