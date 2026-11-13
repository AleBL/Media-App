import { describe, expect, it } from 'vitest';
import { version as vueVersion } from 'vue';
import { DEPENDENCIES, MEDIA_TYPES } from '@/util/constants';

describe('DEPENDENCIES', () => {
  it('reports the installed versions', () => {
    expect(DEPENDENCIES.VUE.VERSION).toBe(vueVersion);

    for (const { VERSION } of Object.values(DEPENDENCIES)) {
      expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it('does not show the version of one package for another', () => {
    expect(DEPENDENCIES.VUEUSE.VERSION).not.toBe(DEPENDENCIES.VUE.VERSION);
    expect(DEPENDENCIES.PRETTIER.VERSION).not.toBe(DEPENDENCIES.VITE.VERSION);
  });
});

describe('MEDIA_TYPES', () => {
  it('uses the names of the TMDB search endpoints', () => {
    expect(MEDIA_TYPES).toEqual({ MOVIE: 'movie', TV_SHOW: 'tv' });
  });
});
