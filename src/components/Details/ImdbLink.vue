<script setup lang="ts">
  defineProps<{
    /** The page of a title or of a person at IMDb. */
    href: string;
  }>();

  const { t } = useI18n();
</script>

<template>
  <!-- In the colors of IMDb, where it leads, opened in the browser. -->
  <a
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex h-9 items-center gap-2 rounded-md bg-imdb px-3.5 text-sm font-semibold text-black no-underline shadow-xs transition hover:brightness-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-surface-800"
  >
    <span class="pi pi-external-link" aria-hidden="true" />
    {{ t('details.imdb') }}
  </a>
</template>
