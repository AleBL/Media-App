<script setup lang="ts">
  import SearchMedia from '../../components/SearchMedia.vue';

  defineProps<{ searchType: number }>();
</script>

<template>
  <SearchMedia :search-type="searchType"></SearchMedia>
</template>
