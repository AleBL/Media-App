
<script setup lang="ts">
  import { getImage, getMediaAttributesByType } from '@/services/searchMediaLogic';
  import { getGenreNames } from "@/util/constants";

  const { locale } = useI18n();

  const currentLocale = locale.value;

defineProps<{
    item: { poster_path: string, genre_ids: number[], vote_average: number },
    mediaType: number
  }>();
  </script>

<template>
    <div class="card-border">
      <div>
        <img class="poster" :src="getImage(item.poster_path)" :alt="item[getMediaAttributesByType(mediaType).propertyName]"/>
      </div>
      <div class="pt-4">
      <div class="flex flex-row justify-between items-start gap-2">
          <div>
          <span class="font-medium text-secondary text-sm">{{ getGenreNames(item.genre_ids, currentLocale) }}</span>
          </div>
          <div class="bg-surface-100 dark:bg-surface-700 p-1" style="border-radius: 30px">
          <div class="surface-0 flex items-center gap-2 justify-center py-1 px-2">
              <span class="text-surface-900 dark:text-surface-0 font-medium text-sm">{{ item.vote_average.toFixed(2) }}</span>
              <i class="pi pi-star-fill text-yellow-500"></i>
          </div>
          </div>
      </div>      
      </div>
      <div class="text-lg font-medium text-surface-900 dark:text-surface-0 mt-1">{{ item[getMediaAttributesByType(mediaType).propertyName] }} ({{ new Date(item[getMediaAttributesByType(mediaType).releaseDate]).getFullYear() }})</div>
    </div>
</template>
  
<style scoped lang="scss">
  @import '@/style/search.css';
</style>