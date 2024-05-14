<script setup lang="ts">
  import { getResult, results, resultsPageCount, totalResults } from "@/services/searchMediaLogic";
  import Paginator from 'primevue/paginator';
  import DataView from 'primevue/dataview';
  import SearchItemCard from '@/components/Search/SearchItemCard.vue';
  import SearchBar from '@/components/Search/SearchBar.vue';
  import { MEDIA_TYPES } from '@/util/constants';

  const mediaType = ref(MEDIA_TYPES.MOVIE);
</script>

<template>
  <SearchBar/>

  <Paginator class="my-4" :rows="resultsPageCount" :totalRecords="totalResults" @page="getResult(mediaType, $event.page + 1)"></Paginator>

  <DataView :value="results" layout="grid" data-key="id">
    <template #grid="slotProps">
      <div class="dataview-cards">
        <div v-for="(item, index) in slotProps.items" :key="index" class="w-full sm:w-2/6 md:w-2/6 xl:w-1/4 2xl:w-1/5 p-2">
          <SearchItemCard :item="item" :mediaType="mediaType" />
        </div>
      </div>
    </template>
  </DataView>
</template>

<style scoped lang="scss">
  @import '@/style/search.css';
</style>
