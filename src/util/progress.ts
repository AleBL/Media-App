import type { MediaDetails, WatchedEpisodes } from '@shared/api';
import { today } from '@/stores/watched';

// What the episodes watched of a show add up to. The specials (season 0)
// can be watched one by one, but never count for the show: not in its
// total, and not for it to be watched in full.

const numbers = (count: number) =>
  Array.from({ length: count }, (_, index) => index + 1);

/**
 * How many episodes of each season are out, the specials apart: the seasons
 * before the last episode aired, whole, and that one up to it. When the last
 * one aired is a special, the seasons that started by today.
 */
export function airedCounts(
  details: MediaDetails,
  day = today(),
): Record<number, number> {
  const last = details.lastEpisode;
  const counts: Record<number, number> = {};

  if (!last) {
    return counts;
  }

  for (const season of details.seasonList ?? []) {
    if (season.number === 0) {
      continue;
    }

    let aired = 0;

    if (last.season === 0) {
      aired = season.airDate && season.airDate <= day ? season.episodeCount : 0;
    } else if (season.number < last.season) {
      aired = season.episodeCount;
    } else if (season.number === last.season) {
      aired = Math.min(last.number, season.episodeCount);
    }

    if (aired > 0) {
      counts[season.number] = aired;
    }
  }

  return counts;
}

/** Every episode out, the specials apart. */
export function allAired(details: MediaDetails): WatchedEpisodes {
  return Object.fromEntries(
    Object.entries(airedCounts(details)).map(([season, count]) => [
      season,
      numbers(count),
    ]),
  );
}

/** The same seasons, with these episodes of one of them in or out. */
export function withEpisodes(
  seasons: WatchedEpisodes,
  season: number,
  episodes: number[],
  watched: boolean,
): WatchedEpisodes {
  const kept = new Set(seasons[season]);

  for (const episode of episodes) {
    if (watched) {
      kept.add(episode);
    } else {
      kept.delete(episode);
    }
  }

  const next = { ...seasons };

  if (kept.size) {
    next[season] = [...kept].sort((a, b) => a - b);
  } else {
    delete next[season];
  }

  return next;
}

/** Both together: every episode of either. */
export function joined(
  seasons: WatchedEpisodes,
  more: WatchedEpisodes,
): WatchedEpisodes {
  return Object.entries(more).reduce(
    (all, [season, episodes]) =>
      withEpisodes(all, Number(season), episodes, true),
    seasons,
  );
}

/**
 * Up to an episode: the episodes of its season up to it (`episodes`, as the
 * season page has them), and every episode out of the seasons before. The
 * specials only among themselves.
 */
export function upTo(
  details: MediaDetails,
  seasons: WatchedEpisodes,
  season: number,
  episodes: number[],
): WatchedEpisodes {
  const here = withEpisodes(seasons, season, episodes, true);

  if (season === 0) {
    return here;
  }

  return Object.entries(airedCounts(details))
    .filter(([number]) => Number(number) < season)
    .reduce(
      (all, [number, count]) =>
        withEpisodes(all, Number(number), numbers(count), true),
      here,
    );
}

/** How many of the first `out` episodes of a season were watched. */
export function watchedOf(
  seasons: WatchedEpisodes,
  season: number,
  out: number,
) {
  return (seasons[season] ?? []).filter((episode) => episode <= out).length;
}

/** The episodes out of the show and how many of them were watched. */
export function showCount(details: MediaDetails, seasons: WatchedEpisodes) {
  return Object.entries(airedCounts(details)).reduce(
    (sum, [season, out]) => ({
      watched: sum.watched + watchedOf(seasons, Number(season), out),
      out: sum.out + out,
    }),
    { watched: 0, out: 0 },
  );
}

/** Every episode out was watched (the specials apart). */
export function isComplete(details: MediaDetails, seasons: WatchedEpisodes) {
  const { watched, out } = showCount(details, seasons);

  return out > 0 && watched === out;
}

/** Some episode of a regular season of `before` is not in `after`. */
export function tookAway(before: WatchedEpisodes, after: WatchedEpisodes) {
  return Object.entries(before).some(([season, episodes]) => {
    const kept = new Set(after[Number(season)]);

    return season !== '0' && episodes.some((episode) => !kept.has(episode));
  });
}
