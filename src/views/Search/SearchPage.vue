<script setup lang="ts">
  import { computed, onMounted, watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import { TMDB_PAGE_SIZE } from '@shared/api';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';
  import { useGenresStore } from '@/stores/genres';
  import { useSearchStore } from '@/stores/search';
  import { accessProblem } from '@/util/access';
  import AppPaginator from '@/components/ui/AppPaginator.vue';
  import SearchItemCard from '@/components/Search/SearchItemCard.vue';
  import SearchBar from '@/components/Search/SearchBar.vue';

  const { t, locale } = useI18n();
  const store = useSearchStore();
  const genres = useGenresStore();
  const credentials = useCredentialsStore();
  const { results, totalResults, currentPage, loading, searched, error } =
    storeToRefs(store);

  const desktop = isDesktop();

  // TMDB answers 20 results per page and never more than 500 pages, which
  // the total already accounts for (shared/tmdb/client.ts).
  const totalPages = computed(() =>
    Math.ceil(totalResults.value / TMDB_PAGE_SIZE),
  );

  // A failure of the credential and not of the search.
  const problem = computed(() =>
    accessProblem(error.value?.code, desktop, credentials.hasKey),
  );

  const errorMessage = computed(() => {
    if (!problem.value) {
      return 'search.error';
    }

    return problem.value === 'webUnavailable'
      ? 'search.errorWebUnavailable'
      : `access.${problem.value}`;
  });

  // The user may be coming back from the settings, where the credential
  // changed: ask again instead of showing the old failure.
  onMounted(() => {
    if (problem.value) {
      store.search(currentPage.value);
    }
  });

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
    class="p-5 text-center text-red-600 dark:text-red-400"
  >
    <p>
      {{ t(errorMessage) }}
    </p>
    <RouterLink v-if="problem && desktop" :to="{ name: 'settings' }">
      {{ t('access.openSettings') }}
    </RouterLink>
  </div>

  <div
    v-else-if="results.length"
    :class="{ 'opacity-50': loading }"
    :aria-busy="loading"
  >
    <AppPaginator
      class="my-4"
      :page="currentPage"
      :total-pages="totalPages"
      @change="(page) => store.search(page)"
    />

    <ul class="m-0 flex list-none flex-wrap p-0">
      <li
        v-for="item in results"
        :key="item.id"
        class="w-full p-2 sm:w-2/6 md:w-2/6 xl:w-1/4 2xl:w-1/5"
      >
        <SearchItemCard :item="item" />
      </li>
    </ul>
  </div>

  <div v-else-if="loading" role="status" class="p-5 text-center">
    {{ t('search.loading') }}
  </div>

  <div v-else-if="searched" class="p-5 text-center">
    {{ t('search.notFound') }}
  </div>
</template>
