<script setup lang="ts">
  import { computed } from 'vue';
  import type { MediaItem } from '@shared/api';
  import CardButtons from '@/components/Account/CardButtons.vue';
  import { useGenresStore } from '@/stores/genres';
  import { posterUrl } from '@/util/images';
  import { mediaPage, mediaTitle, mediaType, mediaYear } from '@/util/media';

  const props = defineProps<{
    item: MediaItem;
    /** Says whether it is a movie or a tv show, among results of both. */
    showType?: boolean;
  }>();

  const { t, locale } = useI18n();
  const genreStore = useGenresStore();

  const title = computed(() => mediaTitle(props.item));
  const year = computed(() => mediaYear(props.item));
  const page = computed(() => mediaPage(props.item));
  const typeLabel = computed(() =>
    mediaType(props.item) === 'tv' ? 'pageTitles.tvShow' : 'pageTitles.movie',
  );

  const genres = computed(() =>
    genreStore.names(props.item.genre_ids, locale.value),
  );

  const rating = computed(() =>
    typeof props.item.vote_average === 'number'
      ? props.item.vote_average.toFixed(2)
      : null,
  );

  // Only the titles of the list of rated titles have one.
  const yourRating = computed(() =>
    typeof props.item.rating === 'number'
      ? new Intl.NumberFormat(locale.value, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(props.item.rating)
      : null,
  );
</script>

<template>
  <!-- Every inner box centered and with the same padding, as the old
       stylesheet of the cards made them. The title is the link to the page
       of the title, and it covers the whole card; the buttons of the lists
       of the account sit above it, on the poster. -->
  <article
    class="relative flex flex-col rounded-md border border-surface-200 bg-surface-0 p-4 transition-shadow duration-200 hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:has-[a:focus-visible]:ring-primary-400"
  >
    <div class="flex justify-center p-3">
      <div class="relative w-full max-w-[400px]">
        <img
          class="w-full rounded-md"
          :src="posterUrl(item.poster_path)"
          :alt="title"
          loading="lazy"
        />
        <CardButtons
          :id="item.id"
          class="absolute right-2 top-2 z-10"
          :type="mediaType(item)"
          :name="title"
        />
      </div>
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
    <p
      v-if="yourRating"
      class="flex items-center justify-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-300"
    >
      <i class="pi pi-star-fill" aria-hidden="true" />
      {{ t('lists.yourRatingIs', { rating: yourRating }) }}
    </p>
    <p
      v-if="showType"
      class="text-center text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400"
    >
      {{ t(typeLabel) }}
    </p>
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
