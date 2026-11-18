<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import { watchDebounced } from '@vueuse/core';
  import type { SearchType } from '@shared/api';
  import AppSegmented from '@/components/ui/AppSegmented.vue';
  import { SEARCH_DEBOUNCE_MS, useSearchStore } from '@/stores/search';
  import { MEDIA_TYPES } from '@/util/constants';

  const { t, locale } = useI18n();
  const store = useSearchStore();
  const { query, mediaType } = storeToRefs(store);

  const types = [
    {
      id: 'mediaTypeMovie',
      value: MEDIA_TYPES.MOVIE,
      label: 'pageTitles.movie',
    },
    {
      id: 'mediaTypeTVShow',
      value: MEDIA_TYPES.TV_SHOW,
      label: 'pageTitles.tvShow',
    },
    // Movies, tv shows and people.
    { id: 'mediaTypeAll', value: MEDIA_TYPES.ALL, label: 'search.all' },
  ];

  const options = computed(() =>
    types.map((type) => ({ value: type.value, label: t(type.label) })),
  );
  const kind = computed({
    get: () => mediaType.value,
    set: (value: string) => {
      mediaType.value = value as SearchType;
    },
  });

  // One request after the user stops typing instead of one per key press.
  watchDebounced(query, () => store.search(), {
    debounce: SEARCH_DEBOUNCE_MS,
  });

  watch(mediaType, () => store.search());

  // TMDB translates titles: ask for the same page again in the new language.
  watch(locale, () => store.search(store.currentPage));
</script>

<template>
  <div class="inset-y-1 left-1/3 my-2 flex flex-wrap justify-center gap-3">
    <div class="relative">
      <input
        v-model="query"
        type="search"
        class="field pr-10 [&::-webkit-search-cancel-button]:appearance-none"
        :placeholder="t('pageTitles.search')"
        :aria-label="t('pageTitles.search')"
      />
      <span
        class="pi pi-search pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500"
        aria-hidden="true"
      />
    </div>

    <!-- Below the field on a narrow screen. -->
    <AppSegmented
      v-model="kind"
      :options="options"
      :label="t('search.kind')"
      name="mediaType"
    />
  </div>
</template>
