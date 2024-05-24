<script setup lang="ts">
  const { t } = useI18n();
</script>

<template>
  <div class="my-5" />
  <div class="text-center">
    <h1 class="mb-3 text-2xl">
      {{ t('pageTitles.home') }}
    </h1>
    Electron + Vite + Vue + Pinia + Vue-Router + Tailwind CSS + Eslint + Prettier
  </div>
</template>
