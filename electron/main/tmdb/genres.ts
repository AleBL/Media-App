import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Genre } from '../../../shared/api';

export const GENRE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface GenreCacheOptions {
  /** Where the lists are kept, one file per language. */
  directory: string;
  fetchGenres: (language: string) => Promise<Genre[]>;
  now?: () => number;
  maxAgeMs?: number;
}

type CachedGenres = { savedAt: number; genres: Genre[] };

/**
 * Genre names change rarely, so they are asked from TMDB once a week per
 * language and read from disk the rest of the time. `language` must already
 * be validated: it becomes part of a file name.
 */
export function createGenreCache(options: GenreCacheOptions) {
  const now = options.now ?? Date.now;
  const maxAgeMs = options.maxAgeMs ?? GENRE_CACHE_MAX_AGE_MS;
  const fileFor = (language: string) =>
    join(options.directory, `genres-${language}.json`);

  async function read(language: string): Promise<CachedGenres | null> {
    try {
      const cached = JSON.parse(await readFile(fileFor(language), 'utf8'));

      return typeof cached?.savedAt === 'number' && Array.isArray(cached.genres)
        ? cached
        : null;
    } catch {
      return null;
    }
  }

  async function write(language: string, genres: Genre[]) {
    try {
      await mkdir(options.directory, { recursive: true });
      await writeFile(
        fileFor(language),
        JSON.stringify({ savedAt: now(), genres }),
      );
    } catch {
      // Without the cache the list is simply asked again next time.
    }
  }

  return {
    async get(language: string): Promise<Genre[]> {
      const cached = await read(language);

      if (cached && now() - cached.savedAt < maxAgeMs) {
        return cached.genres;
      }

      try {
        const genres = await options.fetchGenres(language);
        await write(language, genres);

        return genres;
      } catch (error) {
        // Offline or without a key: an old list is better than none.
        if (cached) {
          return cached.genres;
        }

        throw error;
      }
    },
  };
}

export type GenreCache = ReturnType<typeof createGenreCache>;
