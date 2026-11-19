<script setup lang="ts">
  import type { MediaItem } from '@shared/api';
  import { sizeOf } from '@/components/Cards/view';
  import AppScrollRow from '@/components/ui/AppScrollRow.vue';
  import { useSettingsStore } from '@/stores/settings';
  import PosterCard from './PosterCard.vue';

  defineProps<{
    items: MediaItem[];
    /** Loading again, in another language. */
    busy: boolean;
  }>();

  const { t } = useI18n();
  // The size chosen for the cards; a list has rows of medium ones.
  const settings = useSettingsStore();
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
      <PosterCard :item="item" :size="sizeOf(settings.view)" />
    </li>
  </AppScrollRow>
</template>
