import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { MediaItem, MediaType, Result, TmdbFailure } from '@shared/api';
import { getApi } from '@/services/api';
import { safeCall, useAccountStore } from '@/stores/account';
import { useEpisodesStore } from '@/stores/episodes';
import { useSessionStore } from '@/stores/session';
import { useWatchedStore } from '@/stores/watched';

const nothing = (): Record<MediaType, MediaItem[]> => ({ movie: [], tv: [] });

const failureOf = (result: Result<MediaItem[]>) =>
  result.ok ? null : result.error;

/**
 * What TMDB recommends to the signed-in account (v4), movies and tv shows,
 * asked once per account and language. TMDB chooses them and does not say
 * how; the app leaves out what it knows the user has already.
 */
export const useForYouStore = defineStore('forYou', () => {
  const session = useSessionStore();
  const account = useAccountStore();
  const watched = useWatchedStore();
  const episodes = useEpisodesStore();
  const titles = ref(nothing());
  /** What the titles are the answer to: the account and the language. */
  const key = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<TmdbFailure | null>(null);
  // Ignores answers of an older request, or of another account.
  let latest = 0;

  watch(
    () => session.account?.id,
    () => {
      titles.value = nothing();
      key.value = null;
      loading.value = false;
      error.value = null;
      latest += 1;
    },
  );

  const ask = (type: MediaType, language: string) =>
    safeCall(() => getApi().account.recommendations({ type, language }));

  /**
   * Asks for both types, unless they came already (or are on their way):
   * after a failure, it asks again. The titles before stay while the new
   * ones come, in another language.
   */
  async function load(language: string) {
    const accountId = session.account?.id;

    if (accountId === undefined) {
      return;
    }

    const wanted = `${accountId}:${language}`;

    if (key.value === wanted && (loading.value || error.value === null)) {
      return;
    }

    const turn = ++latest;

    key.value = wanted;
    loading.value = true;
    error.value = null;

    const [movie, tv] = await Promise.all([
      ask('movie', language),
      ask('tv', language),
    ]);

    if (turn !== latest) {
      return;
    }

    loading.value = false;

    const failure = failureOf(movie) ?? failureOf(tv);

    if (failure) {
      titles.value = nothing();
      error.value = failure;

      if (failure.code === 'signed-out') {
        void session.load();
      }

      return;
    }

    titles.value = {
      movie: movie.ok ? movie.data : [],
      tv: tv.ok ? tv.data : [],
    };
  }

  /**
   * In the watchlist or the favorites, rated, watched or with an episode
   * watched, as far as the app knows: the lists of the cards, and the
   * titles the user opened or marked.
   */
  function isKnown(item: MediaItem, type: MediaType) {
    const title = { type, id: item.id };
    const states = account.statesOf(title);
    const seasons = type === 'tv' ? episodes.shows[item.id] : undefined;

    return (
      !!states?.watchlist ||
      !!states?.favorite ||
      typeof account.ratingOf(title) === 'number' ||
      watched.stateOf(title) === true ||
      Object.values(seasons ?? {}).some((numbers) => numbers.length > 0)
    );
  }

  /** Of a type, or both in turn: a movie, a tv show, a movie. */
  function shown(kind: MediaType | 'all'): MediaItem[] {
    const movies = titles.value.movie.filter((item) => !isKnown(item, 'movie'));
    const shows = titles.value.tv.filter((item) => !isKnown(item, 'tv'));

    if (kind !== 'all') {
      return kind === 'movie' ? movies : shows;
    }

    return Array.from(
      { length: Math.max(movies.length, shows.length) },
      (_, index) => [movies[index], shows[index]],
    )
      .flat()
      .filter((item): item is MediaItem => item !== undefined);
  }

  return { titles, key, loading, error, load, shown };
});
