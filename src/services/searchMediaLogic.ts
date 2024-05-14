import { ref } from 'vue';
import { theMovieDb } from '../util/tmdb';
import { MEDIA_TYPES } from "../util/constants";

export const searchText = ref('');
export const results = ref([]);
export const resultsPageCount = ref(0);
export const totalResults = ref(0);
export const currentPage = ref(1);

export let resultPropertyName = '';

export async function getResult(mediaType, page = 1) {
  results.value = [];

  if (!searchText.value || searchText.value.length === 0) {
    return;
  }

  const params = {
    query: searchText.value,
    page: page
  };

  try {
    const { searchFunction } = getMediaAttributesByType(mediaType);
    const { response } = await theMovieDb.search[searchFunction](params);

    results.value = response.results;
    currentPage.value = response.page;
    totalResults.value = response.total_pages;
    resultsPageCount.value = response.results.length;
  } catch (error) {
    // @ts-expect-error error is of type unknow
    alert(`Error: ${error?.status} \n Message: + ${error?.response?.status_message}`);
  }
};

export function getImage(path: string = '') {
  if (!path){
    return '/src/assets/default_search.jpg';
  }

  const params = { file: path };

  return theMovieDb.common.getImage(params);
};

export function getMediaAttributesByType(mediaType: number): {propertyName: string, searchFunction: string, releaseDate: string} {
  switch (mediaType) {
    case MEDIA_TYPES.MOVIE:
      return {
        propertyName: 'title',
        searchFunction: 'getMovie',
        releaseDate: 'release_date'
      }
    case MEDIA_TYPES.TV_SHOW:
      return {
        propertyName: 'name',
        searchFunction: 'getTv',
        releaseDate: 'first_air_date'
      }
    default:
      throw new Error('Tipo de busca inválido: ' + mediaType);
  }
};
