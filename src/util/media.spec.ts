import { describe, expect, it } from 'vitest';
import { mediaPage, mediaTitle, mediaYear } from '@/util/media';

describe('media helpers', () => {
  it('reads the title of a movie and the name of a tv show', () => {
    expect(mediaTitle({ id: 603, title: 'The Matrix' })).toBe('The Matrix');
    expect(mediaTitle({ id: 1396, name: 'Breaking Bad' })).toBe('Breaking Bad');
    expect(mediaTitle({ id: 1 })).toBe('');
  });

  it('keeps the year of January 1st in any timezone', () => {
    // vitest.config.mts runs the tests in a timezone behind UTC
    expect(mediaYear({ id: 1, release_date: '2020-01-01' })).toBe('2020');
    expect(mediaYear({ id: 1, first_air_date: '2008-01-20' })).toBe('2008');
    expect(mediaYear({ id: 1, release_date: '' })).toBeNull();
  });

  it('finds the page of a title by its type, or by its fields', () => {
    expect(mediaPage({ id: 1396, media_type: 'tv', title: 'x' })).toEqual({
      name: 'details',
      params: { type: 'tv', id: 1396 },
    });
    expect(mediaPage({ id: 603, title: 'The Matrix' })).toMatchObject({
      params: { type: 'movie' },
    });
    expect(mediaPage({ id: 1396, name: 'Breaking Bad' })).toMatchObject({
      params: { type: 'tv' },
    });
  });
});
