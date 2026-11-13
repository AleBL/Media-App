import { describe, expect, it } from 'vitest';
import { posterUrl } from '@/util/images';

describe('posterUrl', () => {
  it('builds a TMDB url sized for the result cards', () => {
    expect(posterUrl('/poster.jpg')).toBe(
      'https://image.tmdb.org/t/p/w500/poster.jpg',
    );
  });

  it('accepts another image size', () => {
    expect(posterUrl('/poster.jpg', 'original')).toBe(
      'https://image.tmdb.org/t/p/original/poster.jpg',
    );
  });

  it.each([null, undefined, ''])(
    'falls back to the placeholder for %s',
    (path) => {
      expect(posterUrl(path)).toContain('default_search.jpg');
    },
  );
});
