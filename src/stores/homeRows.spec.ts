import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { readChoice } from '@/components/Discover/query';
import {
  DEFAULT_ROWS,
  rowId,
  rowType,
  seeAllQuery,
  useHomeRowsStore,
} from '@/stores/homeRows';

const kept = () => JSON.parse(localStorage.getItem('home-rows')!);

describe('rows of the home page', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('starts with the rows of the app', () => {
    const store = useHomeRowsStore();

    expect(store.rows).toEqual(DEFAULT_ROWS);
    expect(store.isDefault).toBe(true);
    expect(store.rows.map(rowId).slice(0, 5)).toEqual([
      'list:trending',
      'list:popular-movies',
      'list:popular-tv',
      'list:now-playing',
      'discover:sort=rating',
    ]);
  });

  it('adds a choice of the Explore page at the top, once, and keeps it', async () => {
    const store = useHomeRowsStore();
    const dramas = readChoice({ type: 'tv', genres: '18', mine: '1' });

    store.add(dramas);
    store.add(dramas);
    await nextTick();

    expect(store.rows[0]).toEqual({
      query: { type: 'tv', genres: '18', mine: '1' },
    });
    expect(store.rows).toHaveLength(DEFAULT_ROWS.length + 1);
    expect(kept()[0]).toEqual({
      query: { type: 'tv', genres: '18', mine: '1' },
    });
    expect(store.rowOf(dramas)).toBe(store.rows[0]);
  });

  it('knows a choice that the home page has as one of its lists', () => {
    const store = useHomeRowsStore();

    expect(store.rowOf(readChoice({ type: 'tv' }))).toEqual({
      list: 'popular-tv',
    });

    store.add(readChoice({}));

    expect(store.rows).toEqual(DEFAULT_ROWS);
  });

  it('takes a row out, moves it, and goes back to the first rows', () => {
    const store = useHomeRowsStore();

    store.remove({ list: 'trending' });
    store.move({ list: 'popular-tv' }, -1);
    // the first cannot go up
    store.move({ list: 'popular-tv' }, -1);

    expect(store.rows.map(rowId).slice(0, 3)).toEqual([
      'list:popular-tv',
      'list:popular-movies',
      'list:now-playing',
    ]);
    expect(store.isDefault).toBe(false);

    store.restore();

    expect(store.rows).toEqual(DEFAULT_ROWS);
    expect(localStorage.getItem('home-rows')).toBeNull();
  });

  it('reads the rows kept, the same way the Explore page writes them', () => {
    localStorage.setItem(
      'home-rows',
      JSON.stringify([
        { list: 'now-playing' },
        { list: 'top_rated' },
        { query: { genres: '18,18', rating: '11', sort: 'rating' } },
        { query: { sort: 'rating', genres: '18' } },
        'trending',
        null,
      ]),
    );

    expect(useHomeRowsStore().rows).toEqual([
      { list: 'now-playing' },
      { query: { sort: 'rating', genres: '18' } },
    ]);
  });

  it('starts again with the rows of the app from rows that are not JSON', () => {
    localStorage.setItem('home-rows', '[object Object]');

    expect(useHomeRowsStore().rows).toEqual(DEFAULT_ROWS);
  });

  it('says the type of each row, and where "See all" leads', () => {
    expect(rowType({ list: 'trending' })).toBe('all');
    expect(rowType({ list: 'popular-tv' })).toBe('tv');
    expect(rowType({ list: 'now-playing' })).toBe('movie');
    expect(rowType({ query: { type: 'tv' } })).toBe('tv');

    expect(seeAllQuery({ list: 'popular-movies' })).toEqual({});
    expect(seeAllQuery({ list: 'popular-tv' })).toEqual({ type: 'tv' });
    expect(seeAllQuery({ list: 'trending' })).toBeNull();
    expect(seeAllQuery({ list: 'now-playing' })).toBeNull();
    expect(seeAllQuery({ query: { genres: '35' } })).toEqual({ genres: '35' });
  });
});
