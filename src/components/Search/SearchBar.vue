<script setup lang="ts">
  import { watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import { watchDebounced } from '@vueuse/core';
  import { SEARCH_DEBOUNCE_MS, useSearchStore } from '@/stores/search';
  import IconField from 'primevue/iconfield';
  import InputIcon from 'primevue/inputicon';
  import InputText from 'primevue/inputtext';
  import RadioButton from 'primevue/radiobutton';
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
    <IconField icon-position="right">
      <InputIcon>
        <i class="pi pi-search" />
      </InputIcon>
      <InputText
        v-model="query"
        :placeholder="t('pageTitles.search')"
        :aria-label="t('pageTitles.search')"
      />
    </IconField>

    <div class="flex items-center">
      <RadioButton
        v-model="mediaType"
        input-id="mediaTypeMovie"
        name="mediaType"
        :value="MEDIA_TYPES.MOVIE"
      />
      <label for="mediaTypeMovie" class="ml-2">{{
        t('pageTitles.movie')
      }}</label>
    </div>

    <div class="flex items-center">
      <RadioButton
        v-model="mediaType"
        input-id="mediaTypeTVShow"
        name="mediaType"
        :value="MEDIA_TYPES.TV_SHOW"
      />
      <label for="mediaTypeTVShow" class="ml-2">{{
        t('pageTitles.tvShow')
      }}</label>
    </div>
  </div>
</template>
