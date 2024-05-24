<script setup lang="ts">
  import {
    mediaType,
    results,
    resultsPageCount,
    totalResults,
    searchText,
    getResult,
  } from '@/services/searchMediaLogic';
  import Paginator from 'primevue/paginator';
  import DataView from 'primevue/dataview';
  import SearchItemCard from '@/components/Search/SearchItemCard.vue';
  import SearchBar from '@/components/Search/SearchBar.vue';

  const { t } = useI18n();
</script>

<template>
  <SearchBar :media-type="mediaType" />

  <div v-if="results.length">
    <Paginator
      class="my-4"
      :rows="resultsPageCount"
      :total-records="totalResults"
      @page="getResult(mediaType, $event.page + 1)"
    />

    <DataView :value="results" layout="grid" data-key="id">
      <template #grid="slotProps">
        <div class="dataview-cards">
          <div
            v-for="(item, index) in slotProps.items"
            :key="index"
            class="w-full p-2 sm:w-2/6 md:w-2/6 xl:w-1/4 2xl:w-1/5"
          >
            <SearchItemCard :item="item" :media-type="mediaType" />
          </div>
        </div>
      </template>
    </DataView>
  </div>
  <div v-else-if="searchText.length" style="text-align: center; padding: 20px;">
    <span>{{ t('search.notFound') }}</span>
  </div>
</template>

<style scoped lang="scss">
  @import '@/style/search.css';
</style>
