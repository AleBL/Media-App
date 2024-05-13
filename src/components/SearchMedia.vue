<script setup lang="ts">
  import { ref } from "vue";
  import { theMovieDb } from '../util/tmdb';
  import { MEDIA_TYPES, getGenreNames } from "../util/constants";
  import DataView from 'primevue/dataview';
  import InputText from 'primevue/inputtext';
  import IconField from 'primevue/iconfield';
  import InputIcon from 'primevue/inputicon';
  import Paginator from 'primevue/paginator';

  const { searchType } = defineProps<{ searchType: number }>();
  const { locale } = useI18n();
  const results = ref([]);
  const currentPage = ref(1);
  const resultsPageCount = ref(0);
  const totalResults = ref(0);
  const searchText = ref('');

  let resultPropertyName = '';
  let searchFunctionName = '';

  switch (searchType) {
    case MEDIA_TYPES.MOVIE:
      resultPropertyName = 'title';
      searchFunctionName = 'getMovie';
      break;
    case MEDIA_TYPES.TV_SHOW:
      resultPropertyName = 'name';
      searchFunctionName = 'getTv';
      break;
    default:
      throw new Error('Tipo de busca inválido: ' + searchType);
  };

  async function getResult (page = 1) {
    results.value = [];

    if (!searchText.value || searchText.value.length === 0) {
      return;
    }

    const params = {
      query: searchText.value,
      page: page
    };

    try {
      const { response } = await theMovieDb.search[searchFunctionName](params);

      results.value = response.results;
      currentPage.value = response.page;
      totalResults.value = response.total_pages;
      resultsPageCount.value = response.results.length;
      console.log(response);
    } catch (error) {
      // @ts-expect-error error is of type unknow
      alert(`Error: ${error.status} \n Message: + ${error.response.status_message}`);
    }
  };

  function getImage (path: string = '') {
    if (!path){
      return '/src/assets/default_search.jpg';
    }

    const params = { file: path };

    return theMovieDb.common.getImage(params);
  };

  function getGenres (genres_ids: number[]) {
    return getGenreNames(genres_ids, locale.value);
  };
</script>

<template>
  <div class="card flex flex-wrap justify-center gap-3 inset-y-1 left-1/3">
    <IconField icon-position="right">
      <InputIcon>
        <i class="pi pi-search" />
      </InputIcon>
      <InputText v-model="searchText" placeholder="Search" @keyup='getResult()' />
    </IconField>
  </div>

  <Paginator class="my-4" :rows="resultsPageCount" :totalRecords="totalResults" @page="getResult($event.page + 1)"></Paginator>

  <DataView :value="results" layout="grid" data-key="id">
    <template #grid="slotProps">
      <div class="dataview-cards">
        <div v-for="(item, index) in slotProps.items" :key="index" class="w-full sm:w-2/6 md:w-2/6 xl:w-1/4 2xl:w-1/5 p-2">
          <div class="card-border">
            <div>
              <img class="poster" :src="getImage(item.poster_path)" :alt="item.title"/>
            </div>
            <div class="pt-4">
              <div class="flex flex-row justify-between items-start gap-2">
                <div>
                  <span class="font-medium text-secondary text-sm">{{ getGenres(item.genre_ids) }}</span>
                </div>
                <div class="bg-surface-100 dark:bg-surface-700 p-1" style="border-radius: 30px">
                  <div class="surface-0 flex items-center gap-2 justify-center py-1 px-2">
                    <span class="text-surface-900 dark:text-surface-0 font-medium text-sm">{{ item.vote_average.toFixed(2) }}</span>
                    <i class="pi pi-star-fill text-yellow-500"></i>
                  </div>
                </div>
              </div>      
            </div>
            <div class="text-lg font-medium text-surface-900 dark:text-surface-0 mt-1">{{ item[resultPropertyName] }}</div>
          </div>
        </div>
      </div>
    </template>
  </DataView>
</template>

<style lang="scss">
  @import '../style/search_media.css';
</style>
