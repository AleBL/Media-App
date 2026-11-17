import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Genre } from '@shared/api';
import { getApi } from '@/services/api';

/** Genre names by language, loaded from TMDB through the main process. */
export const useGenresStore = defineStore('genres', () => {
  const byLanguage = ref<Record<string, Genre[]>>({});
  const pending = new Map<string, Promise<void>>();

  /**
   * Loads the genres of a language once. A failure (no key yet, offline)
   * leaves the names empty and the next call tries again.
   */
  function load(language: string): Promise<void> {
    if (byLanguage.value[language]) {
      return Promise.resolve();
    }

    let request = pending.get(language);

    if (!request) {
      request = Promise.resolve()
        .then(() => getApi().tmdb.genres(language))
        .then((answer) => {
          if (answer.ok) {
            byLanguage.value = { ...byLanguage.value, [language]: answer.data };
          }
        })
        .catch(() => {})
        .finally(() => pending.delete(language));

      pending.set(language, request);
    }

    return request;
  }

  /** "Action, Drama" for the given ids, or '' while the names are unknown. */
  function names(ids: number[] | undefined, language: string) {
    const genres = byLanguage.value[language];

    if (!ids?.length || !genres) {
      return '';
    }

    return ids
      .map((id) => genres.find((genre) => genre.id === id)?.name)
      .filter((name) => name !== undefined)
      .join(', ');
  }

  return { byLanguage, load, names };
});
