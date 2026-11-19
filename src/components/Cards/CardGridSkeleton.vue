<script setup lang="ts">
  import PosterCardSkeleton from '@/components/Home/PosterCardSkeleton.vue';
  import AppSkeleton from '@/components/ui/AppSkeleton.vue';
  import { useSettingsStore } from '@/stores/settings';
  import { GRID_SIZE } from './view';

  defineProps<{
    /** What is loading, for screen readers. */
    label: string;
    /** Already in the column of a page, such as beside the filters. */
    bare?: boolean;
  }>();

  const settings = useSettingsStore();
</script>

<template>
  <!-- The shape of the titles until they come, in the view chosen. -->
  <div
    v-if="settings.view === 'list'"
    role="status"
    :class="[!bare && 'page', 'flex flex-col gap-3 py-4']"
  >
    <span class="sr-only">{{ label }}</span>
    <div
      v-for="index in 6"
      :key="index"
      class="flex gap-4 rounded-lg border border-surface-200 p-3 dark:border-surface-700"
      aria-hidden="true"
    >
      <AppSkeleton class="aspect-[2/3] w-16 shrink-0 sm:w-20" />
      <div class="flex-1">
        <AppSkeleton class="h-5 w-1/2" />
        <AppSkeleton class="mt-2 h-4 w-1/3" />
        <AppSkeleton class="mt-3 h-4 w-full" />
        <AppSkeleton class="mt-1.5 h-4 w-4/5" />
      </div>
    </div>
  </div>
  <div
    v-else
    role="status"
    :class="[!bare && 'page', 'card-grid py-4', GRID_SIZE[settings.view]]"
  >
    <span class="sr-only">{{ label }}</span>
    <PosterCardSkeleton v-for="index in 12" :key="index" />
  </div>
</template>
