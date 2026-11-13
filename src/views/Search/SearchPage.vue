<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import { TMDB_PAGE_SIZE } from '@shared/api';
  import { useGenresStore } from '@/stores/genres';
  import { useSearchStore } from '@/stores/search';
  import Paginator from 'primevue/paginator';
  import DataView from 'primevue/dataview';
  import SearchItemCard from '@/components/Search/SearchItemCard.vue';
  import SearchBar from '@/components/Search/SearchBar.vue';

  const { t, locale } = useI18n();
  const store = useSearchStore();
  const genres = useGenresStore();
  const { results, totalResults, currentPage, loading, searched, error } =
    storeToRefs(store);

  const needsKey = computed(
    () =>
      error.value?.code === 'missing-credential' ||
      error.value?.code === 'unauthorized',
  );

  // Genre names come from TMDB too. Asking again after each answer costs
  // nothing once they are loaded, and recovers from an earlier failure.
  watch([locale, results], () => genres.load(locale.value), {
    immediate: true,
  });
</script>

<template>
  <SearchBar />

  <div
    v-if="error"
    role="alert"
    class="search-message text-red-600 dark:text-red-400"
  >
    <p>
      {{ needsKey ? t('search.errorUnauthorized') : t('search.error') }}
    </p>
    <RouterLink v-if="needsKey" :to="{ name: 'home' }">
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
      :first="(currentPage - 1) * TMDB_PAGE_SIZE"
      :rows="TMDB_PAGE_SIZE"
      :total-records="totalResults"
      :always-show="false"
      @page="store.search($event.page + 1)"
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
