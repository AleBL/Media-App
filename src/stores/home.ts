import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  DiscoverRequest,
  ListRequest,
  MediaItem,
  Result,
  TmdbFailure,
} from '@shared/api';
import { getApi } from '@/services/api';

/** What a row of the home page asks TMDB: a list, or a discovery. */
export type RowRequest = { list: ListRequest } | { discover: DiscoverRequest };

export interface RowState {
  items: MediaItem[];
  /** What the items are the answer to, or are being asked as. */
  key: string | null;
  loading: boolean;
  error: TmdbFailure | null;
}

const NOTHING: RowState = Object.freeze({
  items: [],
  key: null,
  loading: false,
  error: null,
});

async function ask(request: RowRequest): Promise<Result<MediaItem[]>> {
  try {
    if ('list' in request) {
      return await getApi().tmdb.list(request.list);
    }

    const answer = await getApi().tmdb.discover(request.discover);

    return answer.ok ? { ok: true, data: answer.data.results } : answer;
  } catch (thrown) {
    return {
      ok: false,
      error: {
        code: 'server',
        message: thrown instanceof Error ? thrown.message : String(thrown),
      },
    };
  }
}

/**
 * The titles of each row of the home page, by the id of the row. Coming
 * back to the home page shows the rows already loaded at once.
 */
export const useHomeStore = defineStore('home', () => {
  const rows = ref<Record<string, RowState>>({});

  // Per row: ignores answers of an older request (such as another language).
  const latest = new Map<string, number>();

  const stateOf = (id: string): RowState => rows.value[id] ?? NOTHING;

  /**
   * Asks for the titles of a row, unless it has them already (or they are
   * on their way). `again` asks anyway, as after a failure.
   */
  async function load(id: string, request: RowRequest, again = false) {
    const key = JSON.stringify(request);
    const current = rows.value[id];

    if (
      !again &&
      current?.key === key &&
      (current.loading || current.error === null)
    ) {
      return;
    }

    const turn = (latest.get(id) ?? 0) + 1;

    latest.set(id, turn);
    // The titles before stay while the new ones come.
    rows.value[id] = {
      items: current?.items ?? [],
      key,
      loading: true,
      error: null,
    };

    const answer = await ask(request);

    if (turn !== latest.get(id)) {
      return;
    }

    rows.value[id] = answer.ok
      ? { items: answer.data, key, loading: false, error: null }
      : { items: [], key, loading: false, error: answer.error };
  }

  /** The failure of some row, which may be one of all of them. */
  const failure = computed(
    () => Object.values(rows.value).find((row) => row.error)?.error ?? null,
  );

  /**
   * Forgets the rows that failed, for them to be asked again, such as
   * after the user changed the key in the settings.
   */
  function forgetFailures() {
    for (const [id, row] of Object.entries(rows.value)) {
      if (row.error) {
        delete rows.value[id];
        latest.delete(id);
      }
    }
  }

  return { rows, stateOf, load, failure, forgetFailures };
});
