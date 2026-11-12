<script setup lang="ts">
  import { watch } from 'vue';
  import { watchDebounced } from '@vueuse/core';
  import {
    mediaType,
    getResult,
    searchText,
    SEARCH_DEBOUNCE_MS,
  } from '@/services/searchMediaLogic';
  import IconField from 'primevue/iconfield';
  import InputIcon from 'primevue/inputicon';
  import InputText from 'primevue/inputtext';
  import RadioButton from 'primevue/radiobutton';
  import { MEDIA_TYPES } from '@/util/constants';

  const { t } = useI18n();

  // One request after the user stops typing instead of one per key press.
  watchDebounced(searchText, () => getResult(mediaType.value), {
    debounce: SEARCH_DEBOUNCE_MS,
  });

  watch(mediaType, (type) => getResult(type));
</script>

<template>
  <div class="inset-y-1 left-1/3 my-2 flex flex-wrap justify-center gap-3">
    <IconField icon-position="right">
      <InputIcon>
        <i class="pi pi-search" />
      </InputIcon>
      <InputText
        v-model="searchText"
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
