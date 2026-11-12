import { describe, expect, it } from 'vitest';
import { version as vueVersion } from 'vue';
import { DEPENDENCIES, getGenreNames } from '@/util/constants';

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

describe('getGenreNames', () => {
  it('returns an empty string when there are no ids', () => {
    expect(getGenreNames([], 'en')).toBe('');
    // @ts-expect-error runtime guard for missing data from the API
    expect(getGenreNames(undefined, 'en')).toBe('');
  });

  it('maps genre ids to names in the given language', () => {
    expect(getGenreNames([28, 12], 'en')).toBe('Action, Adventure');
    expect(getGenreNames([28, 12], 'es')).toBe('Acción, Aventura');
  });

  it('drops the region suffix of the locale', () => {
    expect(getGenreNames([28], 'pt-BR')).toBe('Ação');
  });

  it('falls back to English for a language without a genre list', () => {
    expect(getGenreNames([28], 'fr')).toBe('Action');
  });

  it('ignores ids that are not in the genre list', () => {
    expect(getGenreNames([28, 999999], 'en')).toBe('Action');
  });
});
