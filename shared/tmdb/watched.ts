import type {
  MediaItem,
  Paged,
  TitleRequest,
  WatchedListRequest,
  WatchedRequest,
} from '../api';
import { TmdbError, type Access, type TmdbClient } from './client';

// The titles whoever signed in watched. TMDB has no such thing, so they go
// in a private list of the account (v4), which the app makes the first time
// a title is marked and finds again by its description, on any computer and
// on the web. The day goes in the comment of each title.

/** What tells the list apart from the other lists of the user. */
export const WATCHED_MARKER = 'media-app:watched';

/** Its name, in the language of the app when it is made. */
const NAMES: Record<string, string> = {
  en: 'Watched',
  pt: 'Assistidos',
  es: 'Vistos',
};

/** How many pages of the lists of the user the app looks through. */
export const MAX_LIST_PAGES = 5;

/** What signing in through v4 gave: the lists of the user need all of it. */
export type UserAccess = Required<Access>;

/**
 * Where the id of the list is kept between requests, so it is looked for
 * once: in memory on the desktop, in a cookie on the web.
 */
export interface ListCache {
  get(): number | undefined;
  set(id: number | undefined): void;
}

/** The access of the user, or why there is none. */
export function userAccess(access: Access | null): UserAccess {
  if (!access) {
    throw new TmdbError('signed-out');
  }

  const { sessionId, accessToken, accountObjectId } = access;

  if (!accessToken || !accountObjectId) {
    throw new TmdbError('sign-in-again');
  }

  return { sessionId, accessToken, accountObjectId };
}

/** A list cache for a process that lives on: the desktop app. */
export function memoryCache() {
  const ids = new Map<string, number>();

  return (access: UserAccess): ListCache => ({
    get: () => ids.get(access.accountObjectId),
    set: (id) =>
      id === undefined
        ? ids.delete(access.accountObjectId)
        : ids.set(access.accountObjectId, id),
  });
}

const EMPTY: Paged<MediaItem> = {
  page: 1,
  results: [],
  totalPages: 0,
  totalResults: 0,
};

type ListClient = Pick<
  TmdbClient,
  | 'userLists'
  | 'createList'
  | 'listItemStatus'
  | 'addToList'
  | 'removeFromList'
  | 'listItems'
>;

export function createWatched(tmdb: ListClient) {
  async function find(access: UserAccess) {
    for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
      const { lists, totalPages } = await tmdb.userLists(
        access.accessToken,
        access.accountObjectId,
        page,
      );
      const found = lists.find((list) =>
        list.description.includes(WATCHED_MARKER),
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

  /** The id of the list; made, in `language`, when given and missing. */
  async function listId(
    access: UserAccess,
    cache: ListCache,
    language?: string,
  ) {
    const kept = cache.get();

    if (kept !== undefined) {
      return kept;
    }

    let id = await find(access);

    if (id === undefined && language) {
      id = await tmdb.createList(access.accessToken, {
        name: NAMES[language.slice(0, 2)] ?? NAMES.en,
        description: `Media App (${WATCHED_MARKER})`,
        language,
      });
    }

    if (id !== undefined) {
      cache.set(id);
    }

    return id;
  }

  /**
   * Runs `work` on the list. A kept id that is no longer a list (deleted on
   * the TMDB website) is looked for once more. Without a list, `none`.
   */
  async function withList<T>(
    access: UserAccess,
    cache: ListCache,
    work: (id: number) => Promise<T>,
    none: T,
    language?: string,
  ): Promise<T> {
    const kept = cache.get() !== undefined;
    const id = await listId(access, cache, language);

    if (id === undefined) {
      return none;
    }

    try {
      return await work(id);
    } catch (error) {
      if (!(kept && error instanceof TmdbError && error.code === 'not-found')) {
        throw error;
      }

      cache.set(undefined);

      const again = await listId(access, cache, language);

      return again === undefined ? none : work(again);
    }
  }

  /**
   * An access token TMDB no longer takes (the user took the access of the
   * app away on the website) is one to sign in again for.
   */
  async function asUser<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof TmdbError && error.status === 401) {
        throw new TmdbError('sign-in-again', 401);
      }

      throw error;
    }
  }

  return {
    /** Whether the title is in the list: never, while there is no list. */
    state: (access: UserAccess, cache: ListCache, title: TitleRequest) =>
      asUser(() =>
        withList(
          access,
          cache,
          (id) => tmdb.listItemStatus(access.accessToken, id, title),
          false,
        ),
      ),

    /** Puts the title in the list, made then if need be, or takes it out. */
    mark: (
      access: UserAccess,
      cache: ListCache,
      { type, id, value, date, language }: WatchedRequest,
    ) =>
      asUser(() =>
        value
          ? withList(
              access,
              cache,
              (list) =>
                tmdb.addToList(access.accessToken, list, { type, id }, date),
              undefined,
              language,
            )
          : withList(
              access,
              cache,
              (list) =>
                tmdb.removeFromList(access.accessToken, list, { type, id }),
              undefined,
            ),
      ),

    /** A page of the list: nothing, while there is no list. */
    list: (
      access: UserAccess,
      cache: ListCache,
      { page, language }: WatchedListRequest,
    ) =>
      asUser(() =>
        withList(
          access,
          cache,
          (id) => tmdb.listItems(access.accessToken, id, page, language),
          { ...EMPTY, page },
        ),
      ),
  };
}

export type Watched = ReturnType<typeof createWatched>;
