import { describe, expect, it } from 'vitest';
import type { MediaDetails } from '@shared/api';
import { BREAKING_BAD } from '@/test/fakeApi';
import {
  airedCounts,
  allAired,
  isComplete,
  joined,
  nextToWatch,
  showCount,
  tookAway,
  upTo,
  watchedOf,
  withEpisodes,
} from './progress';

const numbers = (count: number) =>
  Array.from({ length: count }, (_, index) => index + 1);

// Two seasons out, a third on the air up to its 4th episode, a fourth to
// come, and specials.
const ON_AIR: MediaDetails = {
  ...BREAKING_BAD,
  seasonList: [
    { number: 1, name: 'Season 1', episodeCount: 7 },
    { number: 2, name: 'Season 2', episodeCount: 13 },
    { number: 3, name: 'Season 3', episodeCount: 10 },
    { number: 4, name: 'Season 4', episodeCount: 8, airDate: '2027-03-01' },
    { number: 0, name: 'Specials', episodeCount: 9 },
  ],
  lastEpisode: { season: 3, number: 4 },
};

describe('what the episodes watched add up to', () => {
  it('counts the episodes out of each season, the specials apart', () => {
    expect(airedCounts(ON_AIR)).toEqual({ 1: 7, 2: 13, 3: 4 });
  });

  it('counts none before the first episode airs', () => {
    expect(airedCounts({ ...ON_AIR, lastEpisode: undefined })).toEqual({});
  });

  it('counts the seasons that started when the last one aired is a special', () => {
    const special = { ...ON_AIR, lastEpisode: { season: 0, number: 9 } };
    const seasonList = ON_AIR.seasonList!.map((season) => ({
      ...season,
      airDate: season.airDate ?? '2020-01-01',
    }));

    expect(airedCounts({ ...special, seasonList }, '2026-11-20')).toEqual({
      1: 7,
      2: 13,
      3: 10,
    });
  });

  it('lists every episode out', () => {
    expect(allAired(ON_AIR)).toEqual({
      1: numbers(7),
      2: numbers(13),
      3: numbers(4),
    });
  });

  it('puts episodes in and out of a season, each once and in order', () => {
    expect(withEpisodes({ 1: [3] }, 1, [2, 1, 3], true)).toEqual({
      1: [1, 2, 3],
    });
    expect(withEpisodes({ 1: [1, 2], 2: [1] }, 2, [1], false)).toEqual({
      1: [1, 2],
    });
    expect(joined({ 1: [1], 0: [2] }, { 1: [2], 2: [1] })).toEqual({
      0: [2],
      1: [1, 2],
      2: [1],
    });
  });

  it('marks up to an episode with every season out before it', () => {
    expect(upTo(ON_AIR, { 0: [1], 3: [9] }, 3, [1, 2])).toEqual({
      0: [1],
      1: numbers(7),
      2: numbers(13),
      3: [1, 2, 9],
    });
  });

  it('marks up to a special among the specials alone', () => {
    expect(upTo(ON_AIR, {}, 0, [1, 2, 3])).toEqual({ 0: [1, 2, 3] });
  });

  it('counts what was watched of what is out', () => {
    const seasons = { 1: numbers(7), 3: [1, 2, 8], 0: numbers(9) };

    expect(watchedOf(seasons, 3, 4)).toBe(2);
    expect(showCount(ON_AIR, seasons)).toEqual({ watched: 9, out: 24 });
  });

  it('is complete with every episode out, without the specials or what is to come', () => {
    expect(isComplete(ON_AIR, allAired(ON_AIR))).toBe(true);
    expect(
      isComplete(ON_AIR, withEpisodes(allAired(ON_AIR), 3, [4], false)),
    ).toBe(false);
    expect(isComplete({ ...ON_AIR, lastEpisode: undefined }, {})).toBe(false);
  });

  it('goes on after the furthest episode watched, past a gap', () => {
    expect(nextToWatch(ON_AIR, { 1: [1, 2, 3, 5] })).toEqual({
      season: 1,
      number: 6,
    });
  });

  it('goes on to the next season out after the last of one', () => {
    expect(nextToWatch(ON_AIR, { 1: numbers(7) })).toEqual({
      season: 2,
      number: 1,
    });
  });

  it('starts at the first episode with nothing watched but specials', () => {
    expect(nextToWatch(ON_AIR, { 0: [1] })).toEqual({ season: 1, number: 1 });
  });

  it('has nothing next with the last episode out watched', () => {
    // the fourth season is still to come
    expect(nextToWatch(ON_AIR, { 3: [4] })).toBeNull();
    expect(nextToWatch({ ...ON_AIR, lastEpisode: undefined }, {})).toBeNull();
  });

  it('tells when an episode of a season was taken away, not a special', () => {
    expect(tookAway({ 1: [1, 2] }, { 1: [1] })).toBe(true);
    expect(tookAway({ 1: [1], 0: [1] }, { 1: [1, 2] })).toBe(false);
  });
});
