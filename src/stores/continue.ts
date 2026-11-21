import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { Episode, MediaDetails, Result, SeasonDetails } from '@shared/api';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';
import { safeCall } from '@/stores/account';
import { useEpisodesStore } from '@/stores/episodes';
import { useSessionStore } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';
import { nextToWatch, showCount, type EpisodeCode } from '@/util/progress';

/** How long the page of a show, or a season of it, is kept. */
export const KEEP_MS = 6 * 60 * 60 * 1000;
/** At most this many shows, the last changed first. */
export const MAX_SHOWS = 60;
/** Requests to TMDB at the same time. */
const AT_ONCE = 4;

/** A show in progress, with the next episode to watch. */
export interface InProgress {
  show: MediaDetails;
  next: EpisodeCode;
  /** Once its season came: its name, picture and day. */
  episode?: Episode;
  /** Out after the last change of the show: the user had caught up. */
  isNew: boolean;
  /** Episodes out of the show, and how many of them were watched. */
  watched: number;
  out: number;
  /** The last change, or the day the new episode came out. */
  activity: string;
}

interface Kept<T> {
  data: T;
  at: number;
  language: string;
}

/** Runs `task` on every item, a few at a time; true for each that went well. */
async function inTurns<T>(items: T[], task: (item: T) => Promise<boolean>) {
  const done: boolean[] = [];
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(AT_ONCE, items.length) }, async () => {
      while (next < items.length) {
        const index = next;

        next += 1;
        done[index] = await task(items[index]);
      }
    }),
  );

  return done;
}

/**
 * The shows the user is watching (stores/episodes.ts), each with its next
 * episode: for the row of the home page and the page of the watched
 * titles. The page of each show and the season of its next episode are
 * asked of TMDB once, then kept for a while.
 */
export const useContinueStore = defineStore('continue', () => {
  const episodes = useEpisodesStore();
  const session = useSessionStore();
  const shows = ref<Record<number, Kept<MediaDetails>>>({});
  const seasons = ref<Record<string, Kept<SeasonDetails>>>({});
  const loading = ref(false);
  /** Nothing could be asked, and there is nothing to show. */
  const failed = ref(false);
  const asking = new Map<string, Promise<boolean>>();

  watch(
    () => session.account?.id,
    () => {
      shows.value = {};
      seasons.value = {};
      failed.value = false;
    },
  );

  const seasonKey = (id: number, season: number) => `${id}:${season}`;

  const fresh = (kept: Kept<unknown> | undefined, language: string) =>
    !!kept && kept.language === language && Date.now() - kept.at < KEEP_MS;

  /** The shows with an episode watched, the last changed first. */
  const followed = computed(() =>
    Object.entries(episodes.shows)
      .filter(([, watched]) => Object.keys(watched).length > 0)
      .map(([id]) => Number(id))
      .sort((a, b) =>
        (episodes.changedAt[b] ?? '').localeCompare(
          episodes.changedAt[a] ?? '',
        ),
      )
      .slice(0, MAX_SHOWS),
  );

  /** The shows with an episode to watch next, the last active first. */
  const list = computed<InProgress[]>(() =>
    followed.value
      .flatMap((id) => {
        const show = shows.value[id]?.data;
        const watched = episodes.shows[id];
        const next = show && watched ? nextToWatch(show, watched) : null;

        if (!show || !next) {
          return [];
        }

        const episode = seasons.value[
          seasonKey(id, next.season)
        ]?.data.episodes.find((one) => one.number === next.number);
        const changed = episodes.changedAt[id] ?? '';
        const isNew =
          !!episode?.airDate && episode.airDate > changed.slice(0, 10);

        return [
          {
            show,
            next,
            episode,
            isNew,
            ...showCount(show, watched),
            activity: isNew ? episode.airDate! : changed,
          },
        ];
      })
      .sort((a, b) => b.activity.localeCompare(a.activity)),
  );

  /** What is asked, so a change of it asks again: shows and seasons. */
  const wanted = computed(() =>
    JSON.stringify([
      i18n.global.locale.value,
      followed.value,
      list.value.map(({ show, next }) => seasonKey(show.id, next.season)),
    ]),
  );

  /** Asks once for what is asked at the same time. */
  function once(key: string, task: () => Promise<boolean>) {
    const running = asking.get(key);

    if (running) {
      return running;
    }

    const promise = task().finally(() => asking.delete(key));

    asking.set(key, promise);

    return promise;
  }

  const askShow = (id: number, language: string, region: string) =>
    once(`show:${id}:${language}`, async () => {
      const answer: Result<MediaDetails> = await safeCall(() =>
        getApi().tmdb.details({ type: 'tv', id, language, region }),
      );

      if (answer.ok && answer.data.type === 'tv') {
        shows.value[id] = { data: answer.data, at: Date.now(), language };
      }

      return answer.ok;
    });

  const askSeason = (id: number, season: number, language: string) =>
    once(`season:${id}:${season}:${language}`, async () => {
      const answer = await safeCall(() =>
        getApi().tmdb.season({ id, season, language }),
      );

      if (answer.ok) {
        seasons.value[seasonKey(id, season)] = {
          data: answer.data,
          at: Date.now(),
          language,
        };
      }

      return answer.ok;
    });

  /** The pages of the shows that are missing, then their next seasons. */
  async function load() {
    const language = i18n.global.locale.value;
    const region = useSettingsStore().regionFor(language);
    const missing = followed.value.filter(
      (id) => !fresh(shows.value[id], language),
    );

    loading.value = true;
    failed.value = false;

    const asked = await inTurns(missing, (id) => askShow(id, language, region));

    await inTurns(
      list.value.filter(
        ({ show, next }) =>
          !fresh(seasons.value[seasonKey(show.id, next.season)], language),
      ),
      ({ show, next }) => askSeason(show.id, next.season, language),
    );

    loading.value = false;
    failed.value =
      asked.length > 0 && !asked.some(Boolean) && list.value.length === 0;
  }

  return { list, followed, wanted, loading, failed, load };
});
