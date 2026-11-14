<script setup lang="ts">
  const { t } = useI18n();
</script>

<template>
  <div class="text-center my-5">
    <h1 class="mb-3 text-2xl">
      {{ t('pageTitles.home') }}
    </h1>
  </div>

  <div class="mx-auto max-w-xl px-4 pb-4 text-center">
    <p class="mb-4">{{ t('homePage.intro') }}</p>
    <RouterLink
      :to="{ name: 'search' }"
      class="inline-flex items-center gap-2 rounded-md bg-primary-500 px-4 py-2 font-semibold text-white no-underline hover:bg-primary-600"
    >
      <span class="pi pi-search" aria-hidden="true" />
      {{ t('homePage.startSearching') }}
    </RouterLink>
  </div>
</template>
