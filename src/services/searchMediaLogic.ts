import { ref } from 'vue';
import { theMovieDb } from '@/util/tmdb';
import { MEDIA_TYPES } from '@/util/constants';
import defaultPoster from '@/assets/default_search.jpg';
import type { MediaItem } from '@/types';

// TMDB always returns 20 results per page and rejects pages above 500.
export const PAGE_SIZE = 20;
export const MAX_PAGES = 500;
export const MIN_QUERY_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 350;

export type SearchError = { status?: number; message?: string };

export const searchText = ref('');
export const mediaType = ref(MEDIA_TYPES.MOVIE);
export const results = ref<MediaItem[]>([]);
export const totalResults = ref(0);
export const currentPage = ref(1);
export const loading = ref(false);
// true once the current query has been answered by the API
export const searched = ref(false);
export const searchError = ref<SearchError | null>(null);

// Incremented on every call, so a slow response to an older request can
// be recognised and dropped instead of overwriting a newer one.
let latestRequest = 0;

function clearResults() {
  results.value = [];
  totalResults.value = 0;
  currentPage.value = 1;
}

export async function getResult(type: number = mediaType.value, page = 1) {
  const request = ++latestRequest;
  const query = searchText.value.trim();

  searchError.value = null;

  if (query.length < MIN_QUERY_LENGTH) {
    clearResults();
    searched.value = false;
    loading.value = false;
    return;
  }

  loading.value = true;

  try {
    const { searchFunction } = getMediaAttributesByType(type);
    const { response } = await theMovieDb.search[searchFunction]({
      // tmdb.js puts the options in the url as they are, so "&" or "#"
      // in the query would cut it short
      query: encodeURIComponent(query),
      page,
    });

    if (request !== latestRequest) return;

    results.value = response.results;
    currentPage.value = response.page;
    totalResults.value = Math.min(
      response.total_results,
      MAX_PAGES * PAGE_SIZE
    );
    searched.value = true;
  } catch (error) {
    if (request !== latestRequest) return;

    const failure = error as {
      status?: number;
      message?: string;
      response?: { status_message?: string };
    };

    clearResults();
    searched.value = false;
    searchError.value = {
      status: failure?.status,
      message: failure?.response?.status_message ?? failure?.message,
    };
  } finally {
    if (request === latestRequest) {
      loading.value = false;
    }
  }
}

export function getImage(path: string = '') {
  if (!path) {
    return defaultPoster;
  }

  const params = { file: path };

  return theMovieDb.common.getImage(params);
}

export function getMediaAttributesByType(mediaType: number): {
  propertyName: string;
  searchFunction: string;
  releaseDate: string;
} {
  switch (mediaType) {
    case MEDIA_TYPES.MOVIE:
      return {
        propertyName: 'title',
        searchFunction: 'getMovie',
        releaseDate: 'release_date',
      };
    case MEDIA_TYPES.TV_SHOW:
      return {
        propertyName: 'name',
        searchFunction: 'getTv',
        releaseDate: 'first_air_date',
      };
    default:
      throw new Error('Tipo de busca inválido: ' + mediaType);
  }
}
