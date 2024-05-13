<script setup lang="ts">
  import { MEDIA_TYPES } from '../../util/constants';
  import SearchPage from './SearchPage.vue';
</script>

<template>
  <SearchPage :search-type="MEDIA_TYPES.TV_SHOW"></SearchPage>
</template>
