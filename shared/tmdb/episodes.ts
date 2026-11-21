import type { WatchedEpisodes } from '../api';

// The episodes watched of a show go in its comment, in the user's private
// list of episodes (watched.ts): the day and time of the last change, then
// each season and its episodes as ranges, the seasons in order.
//
//   2026-11-20T21:05;1:1-7,9;2:1-13;0:1
//
// Short for a show watched in order (all of The Simpsons in about 300
// characters) and readable on the TMDB website, where the list shows it.

/** A day, with the time of the change or without it. */
const CHANGED = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
const SEASON = /^(\d{1,4}):(\d{1,5}(?:-\d{1,5})?(?:,\d{1,5}(?:-\d{1,5})?)*)$/;

/** Far above any season TMDB has; a number past it is not an episode. */
export const MAX_EPISODE = 10_000;
/** Every episode of the longest soap operas, and then some. */
export const MAX_MARKED = 50_000;
/**
 * Far below what a comment takes (20,000 characters came back whole in
 * 2026-11-20), and short enough to go in the address of a web request.
 */
export const MAX_PROGRESS_LENGTH = 6000;

/** 1, 2, 3 and 5 as "1-3,5". */
function toRanges(episodes: number[]) {
  const sorted = [...new Set(episodes)].sort((a, b) => a - b);
  const parts: string[] = [];

  for (let start = 0; start < sorted.length;) {
    let end = start;

    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) {
      end += 1;
    }

    parts.push(
      start === end ? `${sorted[start]}` : `${sorted[start]}-${sorted[end]}`,
    );
    start = end + 1;
  }

  return parts.join(',');
}

/** The seasons with episodes, in order: "1:1-7,9;2:1-13". */
export function encodeSeasons(seasons: WatchedEpisodes): string {
  return Object.entries(seasons)
    .filter(([, episodes]) => episodes.length > 0)
    .map(([season, episodes]) => [Number(season), episodes] as const)
    .sort(([a], [b]) => a - b)
    .map(([season, episodes]) => `${season}:${toRanges(episodes)}`)
    .join(';');
}

/**
 * Back from `encodeSeasons`; null when any part is not a season, or when
 * there are more episodes than anyone watched.
 */
export function decodeSeasons(text: string): WatchedEpisodes | null {
  const seasons: WatchedEpisodes = {};
  let marked = 0;

  if (!text) {
    return seasons;
  }

  for (const part of text.split(';')) {
    const match = SEASON.exec(part);

    if (!match) {
      return null;
    }

    const season = Number(match[1]);
    const episodes = new Set(seasons[season]);

    for (const range of match[2].split(',')) {
      const [first, last = first] = range.split('-').map(Number);

      if (first < 1 || last < first || last > MAX_EPISODE) {
        return null;
      }

      marked += last - first + 1;

      if (marked > MAX_MARKED) {
        return null;
      }

      for (let episode = first; episode <= last; episode += 1) {
        episodes.add(episode);
      }
    }

    seasons[season] = [...episodes].sort((a, b) => a - b);
  }

  return seasons;
}

/** The comment of a show: when it changed, then its seasons. */
export function encodeProgress(date: string, seasons: WatchedEpisodes) {
  return `${date};${encodeSeasons(seasons)}`;
}

/**
 * Back from `encodeProgress`; null for any other comment, or one without an
 * episode. A season this version cannot read is left out, not the show.
 */
export function decodeProgress(
  comment: unknown,
): { changedAt: string; seasons: WatchedEpisodes } | null {
  if (typeof comment !== 'string' || comment.length > MAX_PROGRESS_LENGTH) {
    return null;
  }

  const [changed, ...parts] = comment.split(';');

  if (!CHANGED.test(changed)) {
    return null;
  }

  const seasons: WatchedEpisodes = {};
  let marked = 0;

  for (const part of parts) {
    const season = decodeSeasons(part);
    const count = season
      ? Object.values(season).reduce((sum, list) => sum + list.length, 0)
      : 0;

    if (season && marked + count <= MAX_MARKED) {
      Object.assign(seasons, season);
      marked += count;
    }
  }

  return Object.keys(seasons).length ? { changedAt: changed, seasons } : null;
}
