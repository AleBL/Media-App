<script setup lang="ts">
  import { getResult, searchText } from "@/services/searchMediaLogic";
  import IconField from 'primevue/iconfield';
  import InputIcon from 'primevue/inputicon';
  import InputText from 'primevue/inputtext';
  import RadioButton from 'primevue/radiobutton';
  import { MEDIA_TYPES } from '@/util/constants';

  const { t } = useI18n();

  const mediaType = ref(MEDIA_TYPES.MOVIE);
</script>

<template>
  <div class="flex flex-wrap justify-center my-2 gap-3 inset-y-1 left-1/3">
    <IconField icon-position="right">
      <InputIcon>
        <i class="pi pi-search" />
      </InputIcon>
      <InputText v-model="searchText" :placeholder="t('pageTitles.search')" @keyup='getResult(mediaType)' />
    </IconField>

    <div class="flex items-center">
      <RadioButton v-model="mediaType" inputId="mediaTypeMovie" :name="t('pageTitles.movie')" :value="MEDIA_TYPES.MOVIE" @change='getResult(mediaType)'/>
      <label for="mediaTypeMovie" class="ml-2">{{t('pageTitles.movie')}}</label>
    </div>

    <div class="flex items-center">
      <RadioButton v-model="mediaType" inputId="mediaTypeTVShow" :name="t('pageTitles.tvShow')" :value="MEDIA_TYPES.TV_SHOW" @change='getResult(mediaType)'/>
      <label for="mediaTypeTVShow" class="ml-2">{{t('pageTitles.tvShow')}}</label>
    </div>
  </div>
</template>

