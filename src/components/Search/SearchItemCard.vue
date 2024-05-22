<script setup lang="ts">
  import {
    mediaType,
    getImage,
    getMediaAttributesByType,
  } from '@/services/searchMediaLogic';
  import { getGenreNames } from '@/util/constants';

  const { locale } = useI18n();

  const currentLocale = locale.value;

  defineProps<{
    item: { poster_path: string; genre_ids: number[]; vote_average: number };
  }>();
</script>

<template>
  <div class="card-border">
    <div>
      <img
        class="poster"
        :src="getImage(item.poster_path)"
        :alt="item[getMediaAttributesByType(mediaType).propertyName]"
      />
    </div>
    <div class="pt-4">
      <div class="flex flex-row items-start justify-between gap-2">
        <div>
          <span class="text-secondary text-sm font-medium">{{
            getGenreNames(item.genre_ids, currentLocale)
          }}</span>
        </div>
        <div
          class="bg-surface-100 p-1 dark:bg-surface-700"
          style="border-radius: 30px"
        >
          <div
            class="surface-0 flex items-center justify-center gap-2 px-2 py-1"
          >
            <span
              class="text-sm font-medium text-surface-900 dark:text-surface-0"
            >
              {{ item.vote_average.toFixed(2) }}
            </span>
            <i class="pi pi-star-fill text-yellow-500" />
          </div>
        </div>
      </div>
    </div>
    <div class="mt-1 text-lg font-medium text-surface-900 dark:text-surface-0">
      {{ item[getMediaAttributesByType(mediaType).propertyName] }} ({{
        new Date(
          item[getMediaAttributesByType(mediaType).releaseDate]
        ).getFullYear()
      }})
    </div>
  </div>
</template>

<style scoped lang="css">
  @import '@/style/search.css';
</style>
