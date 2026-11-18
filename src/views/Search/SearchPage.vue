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
  import { isPerson, searchKey } from '@/util/media';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadMore from '@/components/ui/AppLoadMore.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppState from '@/components/ui/AppState.vue';
  import PersonCard from '@/components/Search/PersonCard.vue';
  import PosterCard from '@/components/Home/PosterCard.vue';
  import PosterCardSkeleton from '@/components/Home/PosterCardSkeleton.vue';
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

  // The search lives in the address too (#/search?q=matrix&type=tv), so a
  // link, reloading and going back find it. A link with a search sets it;
  // without one, the search already here goes into the address.
  const SEARCH_TYPES: SearchType[] = ['movie', 'tv', 'multi'];

  function toAddress() {
    const text = query.value.trim();
    const next = {
      ...(text && { q: text }),
      ...(mediaType.value !== 'movie' && { type: mediaType.value }),
    };

    if (route.query.q !== next.q || route.query.type !== next.type) {
      void router.replace({ query: next });
    }
  }

  // First from the address, then into it: the other way round, an empty
  // search here would wipe the one of the link before it is read.
  onMounted(() => {
    const { q, type } = route.query;

    if (typeof q === 'string') {
      query.value = q;
      mediaType.value = SEARCH_TYPES.includes(type as SearchType)
        ? (type as SearchType)
        : 'movie';
    } else {
      toAddress();
    }
  });

  watch([query, mediaType], toAddress);

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

    <!-- A search of everything mixes movies, tv shows and people, and two
         of them can have the same id. -->
    <ul class="page card-grid list-none py-4">
      <li v-for="item in results" :key="searchKey(item)">
        <PersonCard v-if="isPerson(item)" :person="item" />
        <PosterCard
          v-else
          :item="item"
          grid
          :show-type="resultsType === 'multi'"
        />
      </li>
    </ul>

    <AppLoadMore
      :loading="loadingMore"
      :failed="moreFailed"
      :has-more="hasMore"
      @more="store.loadMore()"
    />
  </div>

  <!-- The shape of the results until they come; the text is for screen
       readers. -->
  <div v-else-if="loading" role="status" class="page card-grid py-4">
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
