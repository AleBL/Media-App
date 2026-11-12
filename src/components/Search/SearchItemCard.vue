<script setup lang="ts">
  import { computed } from 'vue';
  import { getImage } from '@/services/searchMediaLogic';
  import { getGenreNames } from '@/util/constants';
  import type { MediaItem } from '@/types';

  const props = defineProps<{
    item: MediaItem;
  }>();

  const { locale } = useI18n();

  // Read from the item itself, not from the selected media type: while a
  // new search is loading, the cards still hold results of the old type.
  const title = computed(() => props.item.title ?? props.item.name ?? '');

  const year = computed(() => {
    const date = props.item.release_date || props.item.first_air_date || '';

    // TMDB sends YYYY-MM-DD. Going through Date would read it as UTC and
    // show the previous year for January 1st in timezones behind UTC.
    return /^\d{4}/.exec(date)?.[0] ?? null;
  });

  const genres = computed(() =>
    getGenreNames(props.item.genre_ids ?? [], locale.value)
  );

  const rating = computed(() =>
    typeof props.item.vote_average === 'number'
      ? props.item.vote_average.toFixed(2)
      : null
  );
</script>

<template>
  <div class="card-border">
    <div>
      <img
        class="poster"
        :src="getImage(item.poster_path ?? '')"
        :alt="title"
        loading="lazy"
      />
    </div>
    <div class="pt-4">
      <div class="flex flex-row items-start justify-between gap-2">
        <div>
          <span class="text-secondary text-sm font-medium">{{ genres }}</span>
        </div>
        <div
          v-if="rating"
          class="bg-surface-100 p-1 dark:bg-surface-700"
          style="border-radius: 30px"
        >
          <div
            class="surface-0 flex items-center justify-center gap-2 px-2 py-1"
          >
            <span
              class="text-sm font-medium text-surface-900 dark:text-surface-0"
            >
              {{ rating }}
            </span>
            <i class="pi pi-star-fill text-yellow-500" />
          </div>
        </div>
      </div>
    </div>
    <div class="mt-1 text-lg font-medium text-surface-900 dark:text-surface-0">
      {{ title }}<template v-if="year"> ({{ year }})</template>
    </div>
  </div>
</template>

<style scoped lang="css">
  @import '@/style/search.css';
</style>
