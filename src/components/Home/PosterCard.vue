<script setup lang="ts">
  import { computed } from 'vue';
  import type { MediaItem } from '@shared/api';
  import { posterUrl } from '@/util/images';
  import { mediaPage, mediaTitle, mediaYear } from '@/util/media';

  const props = defineProps<{
    item: MediaItem;
  }>();

  const title = computed(() => mediaTitle(props.item));
  const year = computed(() => mediaYear(props.item));
  const page = computed(() => mediaPage(props.item));

  const rating = computed(() =>
    props.item.vote_average ? props.item.vote_average.toFixed(1) : null,
  );
</script>

<template>
  <!-- A title in a list of the home page. Its name is the link to its page,
       and the link covers the whole card. -->
  <article class="group relative w-36 sm:w-40">
    <img
      :src="posterUrl(item.poster_path, 'w342')"
      alt=""
      loading="lazy"
      class="aspect-[2/3] w-full rounded-md bg-surface-100 object-cover shadow-sm transition-shadow duration-200 group-hover:shadow-md group-has-[:focus-visible]:ring-2 group-has-[:focus-visible]:ring-primary-500 dark:bg-surface-800 dark:group-has-[:focus-visible]:ring-primary-400"
    />
    <h3 class="mt-2 line-clamp-2 text-sm font-medium">
      <RouterLink
        :to="page"
        class="text-surface-900 no-underline outline-hidden after:absolute after:inset-0 dark:text-surface-0"
      >
        {{ title }}
      </RouterLink>
    </h3>
    <p
      class="mt-0.5 flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400"
    >
      <span v-if="year">{{ year }}</span>
      <span v-if="rating" class="flex items-center gap-1">
        <i class="pi pi-star-fill text-yellow-500" aria-hidden="true" />
        {{ rating }}
      </span>
    </p>
  </article>
</template>
