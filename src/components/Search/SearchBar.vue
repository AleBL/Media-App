<script setup lang="ts">
  import {
    mediaType,
    getResult,
    searchText,
  } from '@/services/searchMediaLogic';
  import IconField from 'primevue/iconfield';
  import InputIcon from 'primevue/inputicon';
  import InputText from 'primevue/inputtext';
  import RadioButton from 'primevue/radiobutton';
  import { MEDIA_TYPES } from '@/util/constants';

  const { t } = useI18n();
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
        @keyup="getResult(mediaType)"
      />
    </IconField>

    <div class="flex items-center">
      <RadioButton
        v-model="mediaType"
        input-id="mediaTypeMovie"
        :name="t('pageTitles.movie')"
        :value="MEDIA_TYPES.MOVIE"
        @change="getResult(mediaType)"
      />
      <label for="mediaTypeMovie" class="ml-2">{{
        t('pageTitles.movie')
      }}</label>
    </div>

    <div class="flex items-center">
      <RadioButton
        v-model="mediaType"
        input-id="mediaTypeTVShow"
        :name="t('pageTitles.tvShow')"
        :value="MEDIA_TYPES.TV_SHOW"
        @change="getResult(mediaType)"
      />
      <label for="mediaTypeTVShow" class="ml-2">{{
        t('pageTitles.tvShow')
      }}</label>
    </div>
  </div>
</template>
