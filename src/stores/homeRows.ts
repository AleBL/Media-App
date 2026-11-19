import { defineStore } from 'pinia';
import { computed } from 'vue';
import { StorageSerializers, useStorage } from '@vueuse/core';
import type { MediaList, MediaType } from '@shared/api';
import {
  readChoice,
  toQuery,
  type DiscoverChoice,
} from '@/components/Discover/query';

/** The address of a choice of the Explore page, such as { type: 'tv' }. */
export type ChoiceQuery = Record<string, string>;

/**
 * A row of the home page: a list of TMDB, or a choice of the Explore page
 * kept as its address, which reads back the same in any language.
 */
export type HomeRow = { list: MediaList } | { query: ChoiceQuery };

const LISTS: readonly MediaList[] = [
  'trending',
  'popular-movies',
  'popular-tv',
  'now-playing',
];

/** What the home page has until the user changes it. */
export const DEFAULT_ROWS: readonly HomeRow[] = [
  { list: 'trending' },
  { list: 'popular-movies' },
  { list: 'popular-tv' },
  { list: 'now-playing' },
  { query: { sort: 'rating' } },
  { query: { type: 'tv', sort: 'rating' } },
  // "Popular action TV shows": Action & Adventure.
  { query: { type: 'tv', genres: '10759' } },
  { query: { genres: '35' } },
  { query: { genres: '16' } },
];

/** The same choice, written the one way the Explore page writes it. */
const queryOf = (choice: DiscoverChoice) => toQuery(choice) as ChoiceQuery;

export const choiceOf = (row: { query: ChoiceQuery }) => readChoice(row.query);

/** Tells the rows apart, such as "list:trending" or "discover:type=tv". */
export const rowId = (row: HomeRow) =>
  'list' in row
    ? `list:${row.list}`
    : `discover:${new URLSearchParams(row.query)}`;

/** The titles a row has: movies, tv shows or both. */
export function rowType(row: HomeRow): MediaType | 'all' {
  if ('query' in row) {
    return choiceOf(row).type;
  }

  return row.list === 'trending'
    ? 'all'
    : row.list === 'popular-tv'
      ? 'tv'
      : 'movie';
}

/**
 * The Explore page with the titles of the row, for "See all"; nothing for
 * a list it cannot show (trending, in theaters).
 */
export function seeAllQuery(row: HomeRow): ChoiceQuery | null {
  if ('query' in row) {
    return row.query;
  }

  if (row.list === 'popular-movies') {
    return {};
  }

  return row.list === 'popular-tv' ? { type: 'tv' } : null;
}

/** A row as kept, or null when it is not one. */
function readRow(value: unknown): HomeRow | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { list, query } = value as Record<string, unknown>;

  if (LISTS.includes(list as MediaList)) {
    return { list: list as MediaList };
  }

  return typeof query === 'object' && query !== null
    ? { query: queryOf(readChoice(query as ChoiceQuery)) }
    : null;
}

/**
 * The rows of the home page, in their order, kept on the device. A row is
 * added from the Explore page, with the filters it has there.
 */
export const useHomeRowsStore = defineStore('homeRows', () => {
  // null: the rows the app starts with. As JSON: with null to start from,
  // useStorage would keep the text as it is.
  const kept = useStorage<unknown>('home-rows', null, undefined, {
    serializer: StorageSerializers.object,
  });

  const rows = computed<HomeRow[]>(() => {
    if (!Array.isArray(kept.value)) {
      return [...DEFAULT_ROWS];
    }

    const seen = new Set<string>();

    return kept.value
      .map(readRow)
      .filter((row): row is HomeRow => row !== null)
      .filter((row) =>
        seen.has(rowId(row)) ? false : (seen.add(rowId(row)), true),
      );
  });

  const isDefault = computed(() => !Array.isArray(kept.value));

  function set(next: HomeRow[]) {
    kept.value = next;
  }

  /** The row of a choice, if the home page has it (as a list, perhaps). */
  function rowOf(choice: DiscoverChoice): HomeRow | undefined {
    const query = new URLSearchParams(queryOf(choice)).toString();

    return rows.value.find((row) => {
      const shown = seeAllQuery(row);

      return shown !== null && new URLSearchParams(shown).toString() === query;
    });
  }

  /** At the top, where the user sees it at once. */
  function add(choice: DiscoverChoice) {
    if (!rowOf(choice)) {
      set([{ query: queryOf(choice) }, ...rows.value]);
    }
  }

  function remove(row: HomeRow) {
    set(rows.value.filter((one) => rowId(one) !== rowId(row)));
  }

  /** One place up (-1) or down (1). */
  function move(row: HomeRow, by: -1 | 1) {
    const next = [...rows.value];
    const from = next.findIndex((one) => rowId(one) === rowId(row));
    const to = from + by;

    if (from !== -1 && to >= 0 && to < next.length) {
      [next[from], next[to]] = [next[to], next[from]];
      set(next);
    }
  }

  function restore() {
    kept.value = null;
  }

  return { rows, isDefault, set, rowOf, add, remove, move, restore };
});
