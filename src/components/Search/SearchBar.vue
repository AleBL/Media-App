<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import { watchDebounced } from '@vueuse/core';
  import type { MediaType, SearchType } from '@shared/api';
  import { FIRST_YEAR, LAST_YEAR, toQuery } from '@/components/Discover/query';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppSegmented from '@/components/ui/AppSegmented.vue';
  import { SEARCH_DEBOUNCE_MS, useSearchStore } from '@/stores/search';
  import { MEDIA_TYPES } from '@/util/constants';

  const { t, locale } = useI18n();
  const store = useSearchStore();
  const { query, mediaType, year } = storeToRefs(store);

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

  // A year typed in, once the field is left; what is not a year is none.
  function setYear(event: Event) {
    const input = event.target as HTMLInputElement;
    const text = input.value.trim();
    const value = Number(text);
    const valid =
      text !== '' &&
      Number.isInteger(value) &&
      value >= FIRST_YEAR &&
      value <= LAST_YEAR;

    year.value = valid ? value : null;

    if (!valid) {
      input.value = '';
    }
  }

  watch(year, () => store.search());

  // TMDB searches by name with the year alone: the other filters are those
  // of the Explore page, for the same type and year.
  const moreFilters = computed(() => ({
    name: 'discover',
    query: toQuery({
      type: mediaType.value as MediaType,
      sort: 'popularity',
      genres: [],
      mine: false,
      ...(year.value !== null && { fromYear: year.value, toYear: year.value }),
    }),
  }));

  // TMDB translates titles: the results start again in the new language,
  // and more come at the end as before.
  watch(locale, () => store.search());
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

    <!-- People have no year, and no filters. -->
    <div v-if="mediaType !== 'multi'" class="flex items-center gap-2">
      <input
        type="number"
        inputmode="numeric"
        class="field w-28"
        :min="FIRST_YEAR"
        :max="LAST_YEAR"
        :value="year ?? ''"
        :placeholder="t('search.year')"
        :aria-label="t('search.yearLabel')"
        @change="setYear"
      />
      <AppButton
        severity="ghost"
        icon="pi pi-sliders-h"
        :label="t('search.moreFilters')"
        :to="moreFilters"
      />
    </div>
  </div>
</template>
