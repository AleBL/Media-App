<script setup lang="ts">
  import { computed, ref, useId, watch } from 'vue';
  import { useIntersectionObserver } from '@vueuse/core';
  import type { MediaType } from '@shared/api';
  import { toDiscovery } from '@/components/Discover/query';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import { useGenresStore } from '@/stores/genres';
  import { useHomeStore, type RowRequest } from '@/stores/home';
  import {
    choiceOf,
    rowId,
    seeAllQuery,
    type HomeRow,
  } from '@/stores/homeRows';
  import { useSettingsStore } from '@/stores/settings';
  import PosterCardSkeleton from './PosterCardSkeleton.vue';
  import PosterRow from './PosterRow.vue';
  import { rowDetails, rowTitle } from './rowText';

  // A row of the home page, which asks TMDB for its titles only once it
  // comes near the screen: ten rows are not ten requests at the start.
  const props = defineProps<{
    row: HomeRow;
    /** The type of the titles shown, for a row of both (trending). */
    kind: MediaType | 'all';
  }>();

  const { t, locale } = useI18n();
  const home = useHomeStore();
  const settings = useSettingsStore();
  const genres = useGenresStore();

  // Trending of a type is a list of its own, kept apart.
  const trendingOf = computed(() =>
    'list' in props.row && props.row.list === 'trending' && props.kind !== 'all'
      ? props.kind
      : null,
  );
  const id = computed(() =>
    trendingOf.value
      ? `${rowId(props.row)}:${trendingOf.value}`
      : rowId(props.row),
  );
  const headingId = useId();

  const request = computed<RowRequest>(() => {
    const language = locale.value;
    const region = settings.regionFor(language);
    const { row } = props;

    if ('list' in row) {
      return {
        list: {
          list: trendingOf.value
            ? trendingOf.value === 'movie'
              ? 'trending-movies'
              : 'trending-tv'
            : row.list,
          language,
          // The theaters of the country.
          ...(row.list === 'now-playing' && { region }),
        },
      };
    }

    const choice = choiceOf(row);

    return {
      discover: {
        ...toDiscovery(choice, {
          language,
          region,
          providers: choice.mine ? settings.myServices : [],
        }),
        page: 1,
      },
    };
  });

  const state = computed(() => home.stateOf(id.value));

  const title = computed(() =>
    rowTitle(props.row, t, (ids) => genres.names(ids, locale.value)),
  );
  const details = computed(() => rowDetails(props.row, t, locale.value));
  const seeAll = computed(() => seeAllQuery(props.row));

  const section = ref<HTMLElement>();
  const near = ref(false);
  const { isSupported, stop } = useIntersectionObserver(
    section,
    ([entry]) => {
      if (entry?.isIntersecting) {
        near.value = true;
        stop();
      }
    },
    { rootMargin: '400px 0px' },
  );

  // Without the observer, everything is near.
  if (!isSupported.value) {
    near.value = true;
  }

  // Once near, and again whenever what it asks changes (the language, the
  // country, the services of the user).
  watch(
    [near, () => JSON.stringify(request.value)],
    () => {
      if (near.value) {
        void home.load(id.value, request.value);
      }
    },
    { immediate: true },
  );
</script>

<template>
  <section ref="section" class="mt-8" :aria-labelledby="headingId">
    <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div class="min-w-0">
        <h2 :id="headingId" class="text-xl font-semibold">{{ title }}</h2>
        <p
          v-if="details"
          class="mt-0.5 text-sm text-surface-500 dark:text-surface-400"
        >
          {{ details }}
        </p>
      </div>
      <RouterLink
        v-if="seeAll"
        :to="{ name: 'discover', query: seeAll }"
        :aria-label="t('homePage.seeAllOf', { title })"
        class="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold no-underline hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        {{ t('homePage.seeAll') }}
        <span class="pi pi-arrow-right text-xs" aria-hidden="true" />
      </RouterLink>
    </div>

    <div
      v-if="state.error"
      role="alert"
      class="mt-3 flex flex-wrap items-center gap-3 text-red-600 dark:text-red-400"
    >
      <p>{{ t('homePage.listError') }}</p>
      <AppButton
        :label="t('homePage.tryAgain')"
        icon="pi pi-refresh"
        severity="secondary"
        @click="home.load(id, request, true)"
      />
    </div>

    <!-- The shape of the row until it comes, or until it is near; the text
         is for screen readers. -->
    <div
      v-else-if="!state.items.length && (state.loading || !state.key)"
      role="status"
      class="mt-4 flex gap-4 overflow-hidden pb-3"
    >
      <span class="sr-only">{{ t('homePage.loading') }}</span>
      <PosterCardSkeleton
        v-for="index in 8"
        :key="index"
        class="w-36 shrink-0 sm:w-40"
      />
    </div>

    <p
      v-else-if="!state.items.length && !state.loading"
      class="mt-3 text-surface-500 dark:text-surface-400"
    >
      {{ t('homePage.emptyRow') }}
    </p>

    <template v-else>
      <!-- Loading again, in another language: the row stays. -->
      <AppLoadingBar v-if="state.loading" class="mt-3" />

      <PosterRow :items="state.items" :busy="state.loading" />
    </template>
  </section>
</template>
