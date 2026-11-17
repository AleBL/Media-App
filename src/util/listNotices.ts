import type { AccountList } from '@shared/api';
import { useToastsStore } from '@/stores/toasts';

type Change = AccountList | 'watched';

const NOTICES: Record<Change, { on: string; off: string }> = {
  watchlist: { on: 'lists.addedWatchlist', off: 'lists.removedWatchlist' },
  favorite: { on: 'lists.addedFavorite', off: 'lists.removedFavorite' },
  watched: { on: 'lists.markedWatched', off: 'lists.unmarkedWatched' },
};

/**
 * Tells in a notice that a title went in or out of a list, with a way to
 * undo it: what a change to a list says, from its page or from a card.
 */
export function noticeListChange(
  t: (key: string) => string,
  change: Change,
  on: boolean,
  undo: () => void,
) {
  useToastsStore().show(t(NOTICES[change][on ? 'on' : 'off']), {
    label: t('toast.undo'),
    run: undo,
  });
}
