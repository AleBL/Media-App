import { computed, watch } from 'vue';
import type { MediaDetails } from '@shared/api';
import { useEpisodesStore } from '@/stores/episodes';
import { useSessionStore } from '@/stores/session';
import { useWatchedStore } from '@/stores/watched';

/**
 * The episodes watched of a show (undefined until known), asked for once
 * per sign-in. Also asks whether the show is marked watched, unless the page
 * does it already (`askMark: false`, as the buttons of the title do).
 */
export function useShowProgress(
  show: () => MediaDetails | null,
  { askMark = true } = {},
) {
  const session = useSessionStore();
  const episodes = useEpisodesStore();
  const watched = useWatchedStore();

  watch(
    () => [session.account?.id, show()?.id] as const,
    ([signedIn, id]) => {
      if (signedIn === undefined || id === undefined) {
        return;
      }

      void episodes.load();

      if (askMark && watched.stateOf({ type: 'tv', id }) === undefined) {
        void watched.load({ type: 'tv', id });
      }
    },
    { immediate: true },
  );

  return computed(() => {
    const details = show();

    return details ? episodes.seasonsOf(details) : undefined;
  });
}
