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

/**
 * How many lists the app tries before it gives up: TMDB goes on listing a
 * list for a while after it is deleted, so more than one can be gone.
 */
export const MAX_LIST_TRIES = 4;

type ListClient = Pick<
  TmdbClient,
  | 'userLists'
  | 'createList'
  | 'updateList'
  | 'listItemStatus'
  | 'addToList'
  | 'removeFromList'
  | 'listItems'
>;

/** What a list the app makes is called and says, in `language`. */
const newList = (language: string) => ({
  name: NAMES[language.slice(0, 2)] ?? NAMES.en,
  description: `Media App (${WATCHED_MARKER})`,
});

export function createWatched(tmdb: ListClient) {
  /** The list, among those of the user; none of `gone`, lists no more. */
  async function find(access: UserAccess, gone: Set<number>) {
    for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
      const { lists, totalPages } = await tmdb.userLists(
        access.accessToken,
        access.accountObjectId,
        page,
      );
      const found = lists.find(
        (list) =>
          !gone.has(list.id) && list.description.includes(WATCHED_MARKER),
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

  /**
   * The id of the list, and whether it was made now: made, in `language`,
   * when given and there is none.
   */
  async function listOf(
    access: UserAccess,
    cache: ListCache,
    gone: Set<number>,
    language?: string,
  ): Promise<{ id: number; made: boolean } | undefined> {
    const kept = cache.get();

    if (kept !== undefined && !gone.has(kept)) {
      return { id: kept, made: false };
    }

    const found = await find(access, gone);
    const list =
      found !== undefined
        ? { id: found, made: false }
        : language
          ? {
              id: await tmdb.createList(access.accessToken, {
                ...newList(language),
                language,
              }),
              made: true,
            }
          : undefined;

    if (list) {
      cache.set(list.id);
    }

    return list;
  }

  /**
   * Runs `work` on the list. A list that is no more (deleted on the TMDB
   * website, which still lists it for a while) is left out, and the next
   * one tried. Without a list, `none`.
   */
  async function withList<T>(
    access: UserAccess,
    cache: ListCache,
    work: (id: number) => Promise<T>,
    none: T,
    language?: string,
  ): Promise<T> {
    const gone = new Set<number>();

    for (let tries = 1; ; tries += 1) {
      const list = await listOf(access, cache, gone, language);

      if (!list) {
        return none;
      }

      try {
        const done = await work(list.id);

        // TMDB makes a list public: it is made private only now, with the
        // first title in it. Changed right after it was made, the first
        // title failed to go in (2026-11-16): the likely cause.
        if (list.made && language) {
          await tmdb
            .updateList(access.accessToken, list.id, newList(language))
            .catch(() => {});
        }

        return done;
      } catch (error) {
        const lost = error instanceof TmdbError && error.code === 'not-found';

        if (!lost || list.made || tries >= MAX_LIST_TRIES) {
          throw error;
        }

        gone.add(list.id);
        cache.set(undefined);
      }
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
