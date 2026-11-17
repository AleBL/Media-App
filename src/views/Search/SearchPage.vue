<script setup lang="ts">
  import { computed, onMounted, watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import { TMDB_PAGE_SIZE } from '@shared/api';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';
  import { useGenresStore } from '@/stores/genres';
  import { useSearchStore } from '@/stores/search';
  import { accessProblem } from '@/util/access';
  import { isPerson, searchKey } from '@/util/media';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppPaginator from '@/components/ui/AppPaginator.vue';
  import AppState from '@/components/ui/AppState.vue';
  import PosterCardSkeleton from '@/components/Home/PosterCardSkeleton.vue';
  import PersonCard from '@/components/Search/PersonCard.vue';
  import SearchItemCard from '@/components/Search/SearchItemCard.vue';
  import SearchBar from '@/components/Search/SearchBar.vue';

  const { t, locale } = useI18n();
  const store = useSearchStore();
  const genres = useGenresStore();
  const credentials = useCredentialsStore();
  const {
    results,
    resultsType,
    totalResults,
    currentPage,
    loading,
    searched,
    error,
  } = storeToRefs(store);

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

  <AppState v-if="error" tone="error" icon="pi pi-exclamation-triangle">
    {{ t(errorMessage) }}
    <template #actions>
      <RouterLink v-if="problem && desktop" :to="{ name: 'settings' }">
        {{ t('access.openSettings') }}
      </RouterLink>
      <!-- Nothing to try again on a site without access: it says so. -->
      <AppButton
        v-else-if="!problem"
        :label="t('search.tryAgain')"
        icon="pi pi-refresh"
        @click="store.search(currentPage)"
      />
    </template>
  </AppState>

  <div v-else-if="results.length" :aria-busy="loading">
    <!-- Another page or type on its way: the results stay readable. -->
    <AppLoadingBar v-if="loading" class="my-1" />

    <AppPaginator
      class="my-4"
      :page="currentPage"
      :total-pages="totalPages"
      @change="(page) => store.search(page)"
    />

    <!-- A search of everything mixes movies, tv shows and people, and two
         of them can have the same id. -->
    <ul class="m-0 flex list-none flex-wrap p-0">
      <li
        v-for="item in results"
        :key="searchKey(item)"
        class="w-full p-2 sm:w-2/6 md:w-2/6 xl:w-1/4 2xl:w-1/5"
      >
        <PersonCard v-if="isPerson(item)" :person="item" />
        <SearchItemCard
          v-else
          :item="item"
          :show-type="resultsType === 'multi'"
        />
      </li>
    </ul>
  </div>

  <!-- The shape of the results until they come; the text is for screen
       readers. -->
  <div
    v-else-if="loading"
    role="status"
    class="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
  >
    <span class="sr-only">{{ t('search.loading') }}</span>
    <PosterCardSkeleton v-for="index in 12" :key="index" />
  </div>

  <AppState
    v-else-if="searched"
    icon="pi pi-search"
    :title="t('search.notFound')"
  >
    {{ t('search.notFoundHint') }}
  </AppState>
</template>
