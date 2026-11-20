import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type {
  MediaDetails,
  Result,
  TmdbFailure,
  WatchedEpisodes,
} from '@shared/api';
import { encodeSeasons } from '@shared/tmdb/episodes';
import i18n from '@/plugins/i18n';
import { getApi } from '@/services/api';
import { safeCall } from '@/stores/account';
import { useSessionStore } from '@/stores/session';
import { today, useWatchedStore } from '@/stores/watched';
import { allAired, isComplete, joined, tookAway } from '@/util/progress';

const OK: Result<null> = { ok: true, data: null };

/** The episodes watched of a show and whether it is marked watched. */
export interface Snapshot {
  seasons: WatchedEpisodes;
  /** Undefined when TMDB did not say. */
  whole?: boolean;
}

/** A copy without Vue's proxies, which IPC cannot send. */
const plain = (seasons: WatchedEpisodes): WatchedEpisodes =>
  Object.fromEntries(
    Object.entries(seasons).map(([season, episodes]) => [
      season,
      [...episodes],
    ]),
  );

/**
 * The episodes watched of every show (shared/tmdb/watched.ts), read once
 * per sign-in. A change shows at once, goes to TMDB in the order made, and
 * is undone if TMDB refuses it. The show and its episodes go together:
 * watching every episode out marks the show watched, and taking one away
 * unmarks it.
 */
export const useEpisodesStore = defineStore('episodes', () => {
  const session = useSessionStore();
  const watched = useWatchedStore();
  /** By show: what the pages show, changes included. */
  const shows = ref<Record<number, WatchedEpisodes>>({});
  const loaded = ref(false);
  const error = ref<TmdbFailure | null>(null);
  // What TMDB has, to go back to when a change fails.
  let saved: Record<number, WatchedEpisodes> = {};
  let loading: Promise<Result<null>> | null = null;
  // The change of each show on its way, and the shows changed again since.
  const sending = new Map<number, Promise<Result<null>>>();
  const waiting = new Set<number>();
  // Changes on every sign-in or sign-out, so late answers are ignored.
  let sessionVersion = 0;

  watch(
    () => session.account?.id,
    () => {
      shows.value = {};
      loaded.value = false;
      error.value = null;
      saved = {};
      loading = null;
      sending.clear();
      waiting.clear();
      sessionVersion += 1;
    },
  );

  function handleFailure<T>(result: Result<T>) {
    if (!result.ok && result.error.code === 'signed-out') {
      void session.load();
    }

    if (!result.ok && result.error.code === 'sign-in-again') {
      watched.needsSignIn = true;
    }

    return result;
  }

  /** Once per sign-in, or again after it failed. */
  function load(): Promise<Result<null>> {
    if (loaded.value) {
      return Promise.resolve(OK);
    }

    if (loading) {
      return loading;
    }

    const version = sessionVersion;

    error.value = null;
    loading = safeCall(() => getApi().watched.progress()).then((answer) => {
      const result = handleFailure(answer);

      if (version !== sessionVersion) {
        return OK;
      }

      loading = null;

      if (!result.ok) {
        error.value = result.error;

        return result;
      }

      shows.value = Object.fromEntries(
        result.data.map((show) => [show.id, show.seasons]),
      );
      saved = { ...shows.value };
      loaded.value = true;

      return OK;
    });

    return loading;
  }

  /**
   * What the user watched of a show, undefined until it is known. A show
   * marked watched before it had episodes counts as every episode out.
   */
  function seasonsOf(details: MediaDetails): WatchedEpisodes | undefined {
    if (!loaded.value) {
      return undefined;
    }

    const own = shows.value[details.id];

    if (own) {
      return own;
    }

    const whole = watched.stateOf({ type: 'tv', id: details.id });

    if (whole === undefined) {
      return undefined;
    }

    return whole ? allAired(details) : {};
  }

  /** One save of a show at a time, in order: the last change wins. */
  function send(id: number): Promise<Result<null>> {
    waiting.add(id);

    const running = sending.get(id);

    if (running) {
      return running;
    }

    const version = sessionVersion;
    const run = (async () => {
      let result = OK;

      while (waiting.has(id)) {
        waiting.delete(id);

        const seasons = plain(shows.value[id] ?? {});

        result = handleFailure(
          await safeCall(() =>
            getApi().watched.saveProgress({
              id,
              seasons,
              date: today(),
              language: i18n.global.locale.value,
            }),
          ),
        );

        // Signed out or another user meanwhile: nothing to undo.
        if (version !== sessionVersion) {
          return result;
        }

        if (!result.ok) {
          waiting.delete(id);

          if (saved[id]) {
            shows.value[id] = saved[id];
          } else {
            delete shows.value[id];
          }

          // The page only says it failed; the console says why (no secrets).
          console.warn(
            'The episodes watched could not be saved:',
            result.error,
          );
          break;
        }

        saved[id] = seasons;
      }

      sending.delete(id);

      return result;
    })();

    sending.set(id, run);

    return run;
  }

  /**
   * The episodes watched of a show become `next`: on the page at once, then
   * at TMDB. Undefined while what was watched is not known.
   */
  function change(
    details: MediaDetails,
    next: WatchedEpisodes,
  ): Promise<Result<null>> | undefined {
    const before = seasonsOf(details);

    if (!before) {
      return undefined;
    }

    const title = { type: 'tv', id: details.id } as const;
    const whole = watched.stateOf(title);
    const complete = isComplete(details, next);

    shows.value[details.id] = next;

    if (whole === false && complete) {
      void watched.toggle(title);
    } else if (whole === true && !complete && tookAway(before, next)) {
      void watched.toggle(title);
    }

    return send(details.id);
  }

  /** What a show is now, to go back to it (`restore`). */
  function snapshot(details: MediaDetails): Snapshot | undefined {
    const seasons = seasonsOf(details);

    return seasons
      ? { seasons, whole: watched.stateOf({ type: 'tv', id: details.id }) }
      : undefined;
  }

  /**
   * Both the episodes and the mark of the show as they were, such as before
   * a change that is undone. Returns once TMDB took both.
   */
  async function restore(
    details: MediaDetails,
    { seasons, whole }: Snapshot,
  ): Promise<Result<null>> {
    const title = { type: 'tv', id: details.id } as const;
    const before = seasonsOf(details) ?? {};
    const same = encodeSeasons(before) === encodeSeasons(seasons);

    if (!same) {
      shows.value[details.id] = seasons;
    }

    const [episodes, show] = await Promise.all([
      same ? OK : send(details.id),
      whole !== undefined && watched.stateOf(title) !== whole
        ? watched.toggle(title)
        : OK,
    ]);

    return episodes.ok ? (show ?? OK) : episodes;
  }

  /**
   * The button of the show: every episode out watched with it, or none.
   * Undefined while what was watched is not known.
   */
  function markShow(
    details: MediaDetails,
    value: boolean,
  ): Promise<Result<null>> | undefined {
    const now = snapshot(details);

    return now
      ? restore(details, {
          seasons: value ? joined(now.seasons, allAired(details)) : {},
          whole: value,
        })
      : undefined;
  }

  return {
    shows,
    loaded,
    error,
    load,
    seasonsOf,
    change,
    snapshot,
    restore,
    markShow,
  };
});
