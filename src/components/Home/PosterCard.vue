<script setup lang="ts">
  import { computed } from 'vue';
  import type { MediaItem } from '@shared/api';
  import CardButtons from '@/components/Account/CardButtons.vue';
  import AppImage from '@/components/ui/AppImage.vue';
  import { useGenresStore } from '@/stores/genres';
  import { posterUrl } from '@/util/images';
  import { mediaPage, mediaTitle, mediaType, mediaYear } from '@/util/media';

  const props = defineProps<{
    item: MediaItem;
    /**
     * In a grid (search, lists of the account) instead of a row of the
     * home page: as wide as its column, the year next to the name, and the
     * genres.
     */
    grid?: boolean;
    /** Says whether it is a movie or a tv show, among results of both. */
    showType?: boolean;
  }>();

  const { t, locale } = useI18n();
  const genreStore = useGenresStore();

  const title = computed(() => mediaTitle(props.item));
  const year = computed(() => mediaYear(props.item));
  const page = computed(() => mediaPage(props.item));
  const name = computed(() =>
    props.grid && year.value ? `${title.value} (${year.value})` : title.value,
  );

  const rating = computed(() =>
    props.item.vote_average ? props.item.vote_average.toFixed(1) : null,
  );

  const genres = computed(() =>
    props.grid ? genreStore.names(props.item.genre_ids, locale.value) : '',
  );

  const typeLabel = computed(() =>
    mediaType(props.item) === 'tv' ? 'pageTitles.tvShow' : 'pageTitles.movie',
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

  // Only the titles of the list of watched titles have one: a day of the
  // calendar, shown as such in every timezone.
  const watchedOn = computed(() => {
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.item.watchedAt ?? '');

    return day
      ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(
          new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])),
        )
      : null;
  });
</script>

<template>
  <!-- A title in a row of the home page or in a grid. Its name is the link
       to its page, and the link covers the whole card; the buttons of the
       lists of the account sit above it, on the poster. -->
  <article :class="['group relative', grid ? 'w-full' : 'w-36 sm:w-40']">
    <AppImage
      :src="posterUrl(item.poster_path, 'w342')"
      class="w-full rounded-md shadow-sm transition-shadow duration-200 group-hover:shadow-md group-has-[a:focus-visible]:ring-2 group-has-[a:focus-visible]:ring-primary-500 dark:group-has-[a:focus-visible]:ring-primary-400"
    />
    <p
      v-if="showType"
      class="mt-2 text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-400"
    >
      {{ t(typeLabel) }}
    </p>
    <h3
      :class="[
        'line-clamp-2 text-sm font-medium',
        showType ? 'mt-0.5' : 'mt-2',
      ]"
    >
      <RouterLink
        :to="page"
        class="text-surface-900 no-underline outline-hidden after:absolute after:inset-0 dark:text-surface-0"
      >
        {{ name }}
      </RouterLink>
    </h3>
    <p
      class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-surface-500 dark:text-surface-400"
    >
      <span v-if="!grid && year">{{ year }}</span>
      <span v-if="rating" class="flex items-center gap-1">
        <i class="pi pi-star-fill text-yellow-500" aria-hidden="true" />
        {{ rating }}
      </span>
      <span v-if="genres" class="line-clamp-1">{{ genres }}</span>
    </p>
    <p
      v-if="yourRating"
      class="mt-1 flex items-center gap-1 text-xs font-semibold text-primary-700 dark:text-primary-300"
    >
      <i class="pi pi-star-fill" aria-hidden="true" />
      {{ t('lists.yourRatingIs', { rating: yourRating }) }}
    </p>
    <p
      v-if="watchedOn"
      class="mt-1 flex items-center gap-1 text-xs font-semibold text-primary-700 dark:text-primary-300"
    >
      <i class="pi pi-check-circle" aria-hidden="true" />
      {{ t('lists.watchedOn', { date: watchedOn }) }}
    </p>
    <CardButtons
      :id="item.id"
      class="absolute right-1.5 top-1.5 z-10"
      :type="mediaType(item)"
      :name="title"
    />
  </article>
</template>
