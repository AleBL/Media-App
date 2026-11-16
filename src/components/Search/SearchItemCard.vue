<script setup lang="ts">
  import { computed } from 'vue';
  import type { MediaItem } from '@shared/api';
  import { useGenresStore } from '@/stores/genres';
  import { posterUrl } from '@/util/images';
  import { mediaPage, mediaTitle, mediaYear } from '@/util/media';

  const props = defineProps<{
    item: MediaItem;
  }>();

  const { locale } = useI18n();
  const genreStore = useGenresStore();

  const title = computed(() => mediaTitle(props.item));
  const year = computed(() => mediaYear(props.item));
  const page = computed(() => mediaPage(props.item));

  const genres = computed(() =>
    genreStore.names(props.item.genre_ids, locale.value),
  );

  const rating = computed(() =>
    typeof props.item.vote_average === 'number'
      ? props.item.vote_average.toFixed(2)
      : null,
  );
</script>

<template>
  <!-- Every inner box centered and with the same padding, as the old
       stylesheet of the cards made them. The title is the link to the page
       of the title, and it covers the whole card. -->
  <article
    class="relative flex flex-col rounded-md border border-surface-200 bg-surface-0 p-4 transition-shadow duration-200 hover:shadow-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:has-[:focus-visible]:ring-primary-400"
  >
    <div class="flex justify-center p-3">
      <img
        class="w-full max-w-[400px] rounded-md"
        :src="posterUrl(item.poster_path)"
        :alt="title"
        loading="lazy"
      />
    </div>
    <div class="flex justify-center p-3">
      <div class="flex items-start justify-center gap-2 p-3">
        <div class="flex justify-center p-3">
          <span class="text-sm font-medium text-surface-500">{{ genres }}</span>
        </div>
        <div
          v-if="rating"
          class="flex justify-center rounded-[30px] bg-surface-100 p-3 dark:bg-surface-700"
        >
          <div class="flex items-center justify-center gap-2 p-3">
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
    <div
      class="mt-1 flex justify-center p-3 text-lg font-medium text-surface-900 dark:text-surface-0"
    >
      <RouterLink
        :to="page"
        class="text-surface-900 no-underline outline-hidden after:absolute after:inset-0 dark:text-surface-0"
      >
        {{ title }}<template v-if="year"> ({{ year }})</template>
      </RouterLink>
    </div>
  </article>
</template>
