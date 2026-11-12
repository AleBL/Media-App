<script setup lang="ts">
  import { computed } from 'vue';
  import {
    mediaType,
    results,
    totalResults,
    currentPage,
    loading,
    searched,
    searchError,
    getResult,
    PAGE_SIZE,
  } from '@/services/searchMediaLogic';
  import Paginator from 'primevue/paginator';
  import DataView from 'primevue/dataview';
  import SearchItemCard from '@/components/Search/SearchItemCard.vue';
  import SearchBar from '@/components/Search/SearchBar.vue';

  const { t } = useI18n();

  const isUnauthorized = computed(() => searchError.value?.status === 401);
</script>

<template>
  <SearchBar />

  <div
    v-if="searchError"
    role="alert"
    class="search-message text-red-600 dark:text-red-400"
  >
    <p>
      {{ isUnauthorized ? t('search.errorUnauthorized') : t('search.error') }}
    </p>
    <RouterLink v-if="isUnauthorized" :to="{ name: 'home' }">
      {{ t('search.configureKey') }}
    </RouterLink>
  </div>

  <div
    v-else-if="results.length"
    :class="{ 'opacity-50': loading }"
    :aria-busy="loading"
  >
    <Paginator
      class="my-4"
      :first="(currentPage - 1) * PAGE_SIZE"
      :rows="PAGE_SIZE"
      :total-records="totalResults"
      :always-show="false"
      @page="getResult(mediaType, $event.page + 1)"
    />

    <DataView :value="results" layout="grid" data-key="id">
      <template #grid="slotProps">
        <div class="dataview-cards">
          <div
            v-for="item in slotProps.items"
            :key="item.id"
            class="w-full p-2 sm:w-2/6 md:w-2/6 xl:w-1/4 2xl:w-1/5"
          >
            <SearchItemCard :item="item" />
          </div>
        </div>
      </template>
    </DataView>
  </div>

  <div v-else-if="loading" role="status" class="search-message">
    {{ t('search.loading') }}
  </div>

  <div v-else-if="searched" class="search-message">
    {{ t('search.notFound') }}
  </div>
</template>

<style scoped lang="scss">
  @import '@/style/search.css';

  .search-message {
    padding: 20px;
    text-align: center;
  }
</style>
