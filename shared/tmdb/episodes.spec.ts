// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  decodeProgress,
  decodeSeasons,
  encodeProgress,
  encodeSeasons,
  MAX_MARKED,
  MAX_PROGRESS_LENGTH,
} from './episodes';

describe('the episodes watched, as a comment', () => {
  it('writes each season in order, the episodes as ranges', () => {
    expect(
      encodeSeasons({ 2: [1, 2, 3], 0: [4], 1: [9, 1, 2, 3, 4, 5, 6, 7, 3] }),
    ).toBe('0:4;1:1-7,9;2:1-3');
  });

  it('leaves out a season without episodes', () => {
    expect(encodeSeasons({ 1: [], 2: [1] })).toBe('2:1');
    expect(encodeSeasons({})).toBe('');
  });

  it('reads back what it wrote', () => {
    const seasons = { 0: [1], 1: [1, 2, 3, 5], 12: [10, 11] };

    expect(decodeSeasons(encodeSeasons(seasons))).toEqual(seasons);
    expect(decodeSeasons('')).toEqual({});
  });

  it.each([
    ['a season without a number', ':1-3'],
    ['an episode 0', '1:0-3'],
    ['a range backwards', '1:5-3'],
    ['a range past any season', '1:1-10001'],
    ['anything else', '1:1-3;two'],
    ['a trailing separator', '1:1-3;'],
  ])('refuses %s', (_case, text) => {
    expect(decodeSeasons(text)).toBeNull();
  });

  it('refuses more episodes than anyone watched', () => {
    const many = Array.from(
      { length: Math.ceil(MAX_MARKED / 10_000) + 1 },
      (_, index) => `${index + 1}:1-10000`,
    ).join(';');

    expect(decodeSeasons(many)).toBeNull();
  });

  it('puts the day of the change first', () => {
    expect(encodeProgress('2026-11-20', { 1: [1, 2], 2: [1] })).toBe(
      '2026-11-20;1:1-2;2:1',
    );
  });

  it('reads the day and the seasons of a comment', () => {
    expect(decodeProgress('2026-11-20;1:1-2;2:1')).toEqual({
      changedAt: '2026-11-20',
      seasons: { 1: [1, 2], 2: [1] },
    });
  });

  it('leaves out a season it cannot read, not the whole show', () => {
    expect(decodeProgress('2026-11-20;1:1-2;x9:abc')).toEqual({
      changedAt: '2026-11-20',
      seasons: { 1: [1, 2] },
    });
  });

  it.each([
    ['the date of a watched title', '2026-11-16'],
    ['a note of the user', 'Loved it'],
    ['no comment', null],
    ['a comment without a season it can read', '2026-11-20;nothing'],
    ['one longer than any it writes', `2026-11-20;${'1:1;'.repeat(2000)}`],
  ])('is nothing for %s', (_case, comment) => {
    expect(decodeProgress(comment)).toBeNull();
  });

  it('keeps every comment it writes within what a web address takes', () => {
    // Every other episode of the longest show there is.
    const seasons = Object.fromEntries(
      Array.from({ length: 40 }, (_, season) => [
        season + 1,
        Array.from({ length: 13 }, (_, index) => index * 2 + 1),
      ]),
    );

    expect(encodeProgress('2026-11-20', seasons).length).toBeLessThan(
      MAX_PROGRESS_LENGTH,
    );
  });
});
