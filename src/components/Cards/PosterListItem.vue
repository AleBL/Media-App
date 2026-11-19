<script setup lang="ts">
  import { computed } from 'vue';
  import type { MediaItem } from '@shared/api';
  import CardButtons from '@/components/Account/CardButtons.vue';
  import AppImage from '@/components/ui/AppImage.vue';
  import { useGenresStore } from '@/stores/genres';
  import { posterUrl } from '@/util/images';
  import { mediaPage, mediaTitle, mediaType, mediaYear } from '@/util/media';
  import { creditRole } from '@/util/people';

  const props = defineProps<{
    item: MediaItem;
    /** Says whether it is a movie or a tv show, among results of both. */
    showType?: boolean;
  }>();

  const { t, locale } = useI18n();
  const genreStore = useGenresStore();

  const title = computed(() => mediaTitle(props.item));
  const year = computed(() => mediaYear(props.item));
  const rating = computed(() =>
    props.item.vote_average ? props.item.vote_average.toFixed(1) : null,
  );
  const genres = computed(() =>
    genreStore.names(props.item.genre_ids, locale.value),
  );
  const typeLabel = computed(() =>
    mediaType(props.item) === 'tv' ? 'pageTitles.tvShow' : 'pageTitles.movie',
  );

  // Only the titles of the page of a person have one.
  const role = computed(() => creditRole(props.item, t));

  const oneDecimal = computed(
    () =>
      new Intl.NumberFormat(locale.value, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
  );

  // Only the titles of the list of rated titles have one.
  const yourRating = computed(() =>
    typeof props.item.rating === 'number'
      ? oneDecimal.value.format(props.item.rating)
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
  <!-- A title as a line of a list: a small poster, the name with the year,
       what TMDB says of it and the start of its synopsis. Its name is the
       link, and the link covers the whole line; the buttons of the lists
       of the account sit above it. -->
  <article
    class="group relative flex gap-4 rounded-lg border border-surface-200 bg-surface-0 p-3 transition-shadow duration-200 hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:has-[a:focus-visible]:ring-primary-400"
  >
    <AppImage
      :src="posterUrl(item.poster_path, 'w185')"
      class="w-16 shrink-0 self-start rounded-md sm:w-20"
    />

    <div class="min-w-0 flex-1">
      <p
        v-if="showType"
        class="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-400"
      >
        {{ t(typeLabel) }}
      </p>
      <h3 class="text-base font-semibold">
        <RouterLink
          :to="mediaPage(item)"
          class="text-surface-900 no-underline outline-hidden after:absolute after:inset-0 dark:text-surface-0"
        >
          {{ title }}
        </RouterLink>
        <!-- The space in the text, for screen readers too. -->
        <span
          v-if="year"
          class="font-normal text-surface-500 dark:text-surface-400"
          >{{ ` (${year})` }}</span
        >
      </h3>
      <p v-if="role" class="text-sm text-surface-700 dark:text-surface-300">
        {{ role }}
      </p>
      <p
        class="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-surface-500 dark:text-surface-400"
      >
        <span v-if="rating" class="flex items-center gap-1">
          <i class="pi pi-star-fill text-yellow-500" aria-hidden="true" />
          {{ rating }}
        </span>
        <span v-if="genres">{{ genres }}</span>
      </p>
      <p
        v-if="item.overview"
        class="mt-1.5 line-clamp-2 max-w-[80ch] text-sm text-surface-700 sm:line-clamp-3 dark:text-surface-300"
      >
        {{ item.overview }}
      </p>
      <p
        v-if="yourRating"
        class="mt-1.5 flex items-center gap-1 text-xs font-semibold text-primary-700 dark:text-primary-300"
      >
        <i class="pi pi-star-fill" aria-hidden="true" />
        {{ t('lists.yourRatingIs', { rating: yourRating }) }}
      </p>
      <p
        v-if="watchedOn"
        class="mt-1.5 flex items-center gap-1 text-xs font-semibold text-primary-700 dark:text-primary-300"
      >
        <i class="pi pi-check-circle" aria-hidden="true" />
        {{ t('lists.watchedOn', { date: watchedOn }) }}
      </p>
      <CardButtons
        :id="item.id"
        class="relative z-10 mt-2"
        :type="mediaType(item)"
        :name="title"
      />
    </div>
  </article>
</template>
