import { describe, expect, it } from 'vitest';
import { posterUrl, profileUrl } from '@/util/images';

describe('profileUrl', () => {
  it('is small for the cast, and larger when asked', () => {
    expect(profileUrl('/keanu.jpg')).toBe(
      'https://image.tmdb.org/t/p/w185/keanu.jpg',
    );
    expect(profileUrl('/keanu.jpg', 'h632')).toBe(
      'https://image.tmdb.org/t/p/h632/keanu.jpg',
    );
  });
});

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
