<script setup lang="ts">
  import { watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import { watchDebounced } from '@vueuse/core';
  import { SEARCH_DEBOUNCE_MS, useSearchStore } from '@/stores/search';
  import { MEDIA_TYPES } from '@/util/constants';

  const { t, locale } = useI18n();
  const store = useSearchStore();
  const { query, mediaType } = storeToRefs(store);

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

    <div class="flex items-center">
      <input
        id="mediaTypeMovie"
        v-model="mediaType"
        type="radio"
        name="mediaType"
        class="h-4 w-4 accent-primary-500 dark:accent-primary-400 dark:[color-scheme:dark]"
        :value="MEDIA_TYPES.MOVIE"
      />
      <label for="mediaTypeMovie" class="ml-2">{{
        t('pageTitles.movie')
      }}</label>
    </div>

    <div class="flex items-center">
      <input
        id="mediaTypeTVShow"
        v-model="mediaType"
        type="radio"
        name="mediaType"
        class="h-4 w-4 accent-primary-500 dark:accent-primary-400 dark:[color-scheme:dark]"
        :value="MEDIA_TYPES.TV_SHOW"
      />
      <label for="mediaTypeTVShow" class="ml-2">{{
        t('pageTitles.tvShow')
      }}</label>
    </div>
  </div>
</template>
