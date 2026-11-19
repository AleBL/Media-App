<script setup lang="ts">
  import { computed, onMounted, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { storeToRefs } from 'pinia';
  import type { SearchType } from '@shared/api';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';
  import { useGenresStore } from '@/stores/genres';
  import { useSearchStore } from '@/stores/search';
  import { accessProblem } from '@/util/access';
  import { FIRST_YEAR, LAST_YEAR } from '@/components/Discover/query';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadMore from '@/components/ui/AppLoadMore.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppState from '@/components/ui/AppState.vue';
  import CardGrid from '@/components/Cards/CardGrid.vue';
  import CardGridSkeleton from '@/components/Cards/CardGridSkeleton.vue';
  import CardViewPicker from '@/components/Cards/CardViewPicker.vue';
  import SearchBar from '@/components/Search/SearchBar.vue';

  const { t, locale } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const store = useSearchStore();
  const genres = useGenresStore();
  const credentials = useCredentialsStore();
  const {
    query,
    mediaType,
    year,
    results,
    resultsType,
    totalResults,
    loading,
    loadingMore,
    moreFailed,
    hasMore,
    searched,
    error,
  } = storeToRefs(store);

  const desktop = isDesktop();

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

  // The search lives in the address too (#/search?q=matrix&type=tv&year=1999),
  // so a link, reloading and going back find it. A link with a search sets
  // it; without one, the search already here goes into the address.
  const SEARCH_TYPES: SearchType[] = ['movie', 'tv', 'multi'];

  function toAddress() {
    const text = query.value.trim();
    const next = {
      ...(text && { q: text }),
      ...(mediaType.value !== 'movie' && { type: mediaType.value }),
      ...(year.value !== null &&
        mediaType.value !== 'multi' && { year: String(year.value) }),
    };

    if (
      route.query.q !== next.q ||
      route.query.type !== next.type ||
      route.query.year !== next.year
    ) {
      void router.replace({ query: next });
    }
  }

  // First from the address, then into it: the other way round, an empty
  // search here would wipe the one of the link before it is read.
  onMounted(() => {
    const { q, type, year: inAddress } = route.query;

    if (typeof q === 'string') {
      const number = Number(inAddress);

      query.value = q;
      mediaType.value = SEARCH_TYPES.includes(type as SearchType)
        ? (type as SearchType)
        : 'movie';
      year.value =
        Number.isInteger(number) && number >= FIRST_YEAR && number <= LAST_YEAR
          ? number
          : null;
    } else {
      toAddress();
    }
  });

  watch([query, mediaType, year], toAddress);

  // The user may be coming back from the settings, where the credential
  // changed: ask again instead of showing the old failure.
  onMounted(() => {
    if (problem.value) {
      store.search();
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
        @click="store.search()"
      />
    </template>
  </AppState>

  <div v-else-if="results.length" :aria-busy="loading || loadingMore">
    <!-- Another type or language on its way: the results stay readable. -->
    <AppLoadingBar v-if="loading" class="my-1" />

    <!-- How many there are, read out again as more come. -->
    <p class="sr-only" aria-live="polite">
      {{ t('search.showing', { shown: results.length, total: totalResults }) }}
    </p>

    <div class="page flex justify-end pt-2">
      <CardViewPicker name="search-view" />
    </div>

    <CardGrid :items="results" :show-type="resultsType === 'multi'" />

    <AppLoadMore
      :loading="loadingMore"
      :failed="moreFailed"
      :has-more="hasMore"
      @more="store.loadMore()"
    />
  </div>

  <!-- The shape of the results until they come; the text is for screen
       readers. -->
  <CardGridSkeleton v-else-if="loading" :label="t('search.loading')" />

  <AppState
    v-else-if="searched"
    icon="pi pi-search"
    :title="t('search.notFound')"
  >
    {{ t('search.notFoundHint') }}
  </AppState>
</template>
