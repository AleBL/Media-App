<script setup lang="ts">
  import type { MediaItem } from '@shared/api';
  import AppScrollRow from '@/components/ui/AppScrollRow.vue';
  import PosterCard from './PosterCard.vue';

  defineProps<{
    items: MediaItem[];
    /** Loading again, in another language. */
    busy: boolean;
  }>();

  const { t } = useI18n();
</script>

<template>
  <!-- A list of the home page, as a row that scrolls sideways. -->
  <AppScrollRow
    :busy="busy"
    :previous-label="t('homePage.previous')"
    :next-label="t('homePage.next')"
  >
    <li
      v-for="item in items"
      :key="`${item.media_type}-${item.id}`"
      class="shrink-0 snap-start"
    >
      <PosterCard :item="item" />
    </li>
  </AppScrollRow>
</template>
