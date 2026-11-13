// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Genre } from '../../../shared/api';
import { createGenreCache, GENRE_CACHE_MAX_AGE_MS } from './genres';

const ACTION: Genre[] = [{ id: 28, name: 'Action' }];
const ACAO: Genre[] = [{ id: 28, name: 'Ação' }];

describe('genre cache', () => {
  let directory: string;
  let now: number;

  function setup(fetchGenres: (language: string) => Promise<Genre[]>) {
    const fetch = vi.fn(fetchGenres);
    const cache = createGenreCache({
      directory,
      fetchGenres: fetch,
      now: () => now,
    });

    return { cache, fetch };
  }

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'media-app-genres-'));
    now = 1_794_500_000_000;
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('asks TMDB once and answers from disk afterwards', async () => {
    const { cache, fetch } = setup(async () => ACTION);

    expect(await cache.get('en')).toEqual(ACTION);
    expect(await cache.get('en')).toEqual(ACTION);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps one list per language', async () => {
    const { cache, fetch } = setup(async (language) =>
      language === 'pt-BR' ? ACAO : ACTION,
    );

    expect(await cache.get('en')).toEqual(ACTION);
    expect(await cache.get('pt-BR')).toEqual(ACAO);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('asks again when the list is older than a week', async () => {
    const { cache, fetch } = setup(async () => ACTION);
    await cache.get('en');

    now += GENRE_CACHE_MAX_AGE_MS + 1;
    await cache.get('en');

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('answers with the old list when TMDB cannot be reached', async () => {
    const first = setup(async () => ACTION);
    await first.cache.get('en');
    now += GENRE_CACHE_MAX_AGE_MS + 1;

    const offline = setup(async () => {
      throw new Error('offline');
    });

    expect(await offline.cache.get('en')).toEqual(ACTION);
  });

  it('fails when there is neither a list nor a connection', async () => {
    const { cache } = setup(async () => {
      throw new Error('offline');
    });

    await expect(cache.get('en')).rejects.toThrow('offline');
  });

  it('ignores a damaged cache file', async () => {
    await writeFile(join(directory, 'genres-en.json'), '{ not json');
    const { cache, fetch } = setup(async () => ACTION);

    expect(await cache.get('en')).toEqual(ACTION);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
