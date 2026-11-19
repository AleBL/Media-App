<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { storeToRefs } from 'pinia';
  import {
    DialogClose,
    DialogContent,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
  } from 'reka-ui';
  import { DISCOVER_SORTS, TMDB_PAGE_SIZE, type MediaType } from '@shared/api';
  import CardGrid from '@/components/Cards/CardGrid.vue';
  import CardGridSkeleton from '@/components/Cards/CardGridSkeleton.vue';
  import CardViewPicker from '@/components/Cards/CardViewPicker.vue';
  import DiscoverFilters from '@/components/Discover/DiscoverFilters.vue';
  import {
    filtersInUse,
    readChoice,
    toQuery,
    withoutFilters,
    type DiscoverChoice,
  } from '@/components/Discover/query';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadMore from '@/components/ui/AppLoadMore.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppSegmented from '@/components/ui/AppSegmented.vue';
  import AppState from '@/components/ui/AppState.vue';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';
  import { useDiscoverStore, type Discovery } from '@/stores/discover';
  import { useGenresStore } from '@/stores/genres';
  import { useSettingsStore } from '@/stores/settings';
  import { accessProblem } from '@/util/access';

  /** TMDB counts up to 500 pages of titles, and stops there. */
  const MOST_COUNTED = 500 * TMDB_PAGE_SIZE;

  const { t, locale } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const store = useDiscoverStore();
  const settings = useSettingsStore();
  const genreNames = useGenresStore();
  const credentials = useCredentialsStore();
  const {
    results,
    totalResults,
    loading,
    loadingMore,
    moreFailed,
    hasMore,
    error,
  } = storeToRefs(store);
  const desktop = isDesktop();

  // The filters are in the address (src/components/Discover/query.ts).
  const choice = computed(() => readChoice(route.query));

  function change(next: Partial<DiscoverChoice>) {
    void router.replace({ query: toQuery({ ...choice.value, ...next }) });
  }

  function clear() {
    void router.replace({ query: toQuery(withoutFilters(choice.value)) });
  }

  const region = computed(() => settings.regionFor(locale.value));

  // What the filters offer, for the type, in the language and the country.
  const filtersRequest = computed(() => ({
    type: choice.value.type,
    language: locale.value,
    region: region.value,
  }));
  const filters = computed(() => store.filtersOf(filtersRequest.value));
  const filtersFailed = computed(() =>
    store.filtersFailedFor(filtersRequest.value),
  );

  watch(filtersRequest, (request) => store.loadFilters(request), {
    immediate: true,
  });

  // Once the filters came, what they do not offer is no filter: genres of
  // the other type, a rating of another country, a service it has not.
  const genres = computed(() => {
    const offered = filters.value?.genres;

    return offered
      ? choice.value.genres.filter((id) =>
          offered.some((genre) => genre.id === id),
        )
      : choice.value.genres;
  });

  const ageRating = computed(() => {
    const offered = filters.value?.ageRatings;
    const rating = choice.value.ageRating;

    return rating && (!offered || offered.includes(rating))
      ? rating
      : undefined;
  });

  const myServices = computed(() => {
    const offered = filters.value?.providers;
    const mine = offered
      ? settings.myServices.filter((id) =>
          offered.some((provider) => provider.id === id),
        )
      : settings.myServices;

    return [...mine].sort((a, b) => a - b);
  });

  const onMine = computed(
    () => choice.value.mine && myServices.value.length > 0,
  );

  const count = computed(() =>
    filtersInUse(
      { ...choice.value, genres: genres.value, ageRating: ageRating.value },
      onMine.value,
    ),
  );

  // Built in the same order every time: the store tells two apart by it.
  const discovery = computed<Discovery>(() => {
    const { type, sort, fromYear, toYear, minRating, originalLanguage } =
      choice.value;

    return {
      type,
      language: locale.value,
      region: region.value,
      sort,
      ...(genres.value.length > 0 && { genres: genres.value }),
      ...(fromYear && { fromYear }),
      ...(toYear && { toYear }),
      ...(minRating && { minRating }),
      ...(originalLanguage && { originalLanguage }),
      ...(ageRating.value && { ageRating: ageRating.value }),
      ...(onMine.value && { providers: myServices.value }),
    };
  });

  // By what it asks, not by the object: the filters coming in build the
  // same discovery again, which is no reason to ask TMDB again.
  watch(
    () => JSON.stringify(discovery.value),
    () => store.discover(discovery.value),
    { immediate: true },
  );

  // The names of the genres under each card.
  watch(locale, () => genreNames.load(locale.value), { immediate: true });

  const typeOptions = computed(() => [
    { value: 'movie', label: t('lists.movies') },
    { value: 'tv', label: t('lists.tvShows') },
  ]);

  // Another type has other genres.
  const type = computed({
    get: () => choice.value.type,
    set: (value: string) => change({ type: value as MediaType, genres: [] }),
  });

  const sortOptions = computed(() =>
    DISCOVER_SORTS.map((sort) => ({
      value: sort,
      label: t(`discover.${sort}`),
    })),
  );

  const sort = computed({
    get: () => choice.value.sort,
    set: (value: string) => change({ sort: value as DiscoverChoice['sort'] }),
  });

  const counted = computed(() => {
    const n = new Intl.NumberFormat(locale.value).format(totalResults.value);

    return totalResults.value >= MOST_COUNTED
      ? t('discover.countMany', { n })
      : t('discover.count', { n }, totalResults.value);
  });

  const showCount = computed(() => {
    const n = new Intl.NumberFormat(locale.value).format(totalResults.value);

    return totalResults.value >= MOST_COUNTED
      ? t('discover.showMany', { n })
      : t('discover.showCount', { n }, totalResults.value);
  });

  // A failure of the credential and not of the discovery.
  const problem = computed(() =>
    accessProblem(error.value?.code, desktop, credentials.hasKey),
  );

  const errorMessage = computed(() => {
    if (!problem.value) {
      return 'discover.error';
    }

    return problem.value === 'webUnavailable'
      ? 'discover.errorWebUnavailable'
      : `access.${problem.value}`;
  });

  const retryFilters = () => store.loadFilters(filtersRequest.value);

  // The filters of a narrow screen, in a drawer from the side.
  const drawer = ref(false);
</script>

<template>
  <div class="page pb-6 pt-4">
    <h1 class="page-title">{{ t('discover.title') }}</h1>

    <div
      class="mt-4 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8 2xl:grid-cols-[19rem_minmax(0,1fr)]"
    >
      <!-- Beside the titles, and in view while they scroll. -->
      <aside
        class="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pb-6 lg:pr-2"
        :aria-label="t('discover.filters')"
      >
        <DiscoverFilters
          :choice="choice"
          :filters="filters"
          :failed="filtersFailed"
          :region="region"
          :count="count"
          id-prefix="panel"
          heading
          @change="change"
          @clear="clear"
          @retry="retryFilters"
        />
      </aside>

      <section :aria-label="t('discover.titles')" class="min-w-0">
        <div class="flex flex-wrap items-center gap-3">
          <AppSegmented
            v-model="type"
            :options="typeOptions"
            :label="t('lists.kind')"
            name="discover-type"
          />
          <AppButton
            class="lg:hidden"
            severity="secondary"
            icon="pi pi-sliders-h"
            :label="
              count
                ? t('discover.filtersCount', { n: count })
                : t('discover.filters')
            "
            aria-haspopup="dialog"
            :aria-expanded="drawer"
            @click="drawer = true"
          />
          <!-- In the drawer on a narrow screen. -->
          <div class="hidden lg:block">
            <AppSegmented
              v-model="sort"
              :options="sortOptions"
              :label="t('discover.order')"
              name="discover-sort"
            />
          </div>
          <CardViewPicker name="discover-view" class="xl:ml-auto" />
        </div>

        <AppState v-if="error" tone="error" icon="pi pi-exclamation-triangle">
          {{ t(errorMessage) }}
          <template #actions>
            <RouterLink v-if="problem && desktop" :to="{ name: 'settings' }">
              {{ t('access.openSettings') }}
            </RouterLink>
            <AppButton
              v-else-if="!problem"
              :label="t('discover.tryAgain')"
              icon="pi pi-refresh"
              @click="store.retry()"
            />
          </template>
        </AppState>

        <div v-else-if="results.length" :aria-busy="loading || loadingMore">
          <!-- Other filters on their way: the titles stay readable. -->
          <AppLoadingBar v-if="loading" class="mt-3" />
          <p
            class="mt-3 text-sm text-surface-500 dark:text-surface-400"
            aria-live="polite"
          >
            {{ counted }}
          </p>

          <CardGrid :items="results" bare />

          <AppLoadMore
            :loading="loadingMore"
            :failed="moreFailed"
            :has-more="hasMore"
            @more="store.loadMore()"
          />
        </div>

        <CardGridSkeleton
          v-else-if="loading"
          :label="t('discover.loading')"
          bare
        />

        <AppState
          v-else
          icon="pi pi-filter-slash"
          :title="t('discover.nothing')"
        >
          {{ t('discover.nothingHint') }}
          <template v-if="count" #actions>
            <AppButton
              severity="secondary"
              icon="pi pi-filter-slash"
              :label="t('discover.clearAll')"
              @click="clear"
            />
          </template>
        </AppState>
      </section>
    </div>

    <!-- At the end of <body>, out of #app: it takes the color of its text
         in the dark theme itself. -->
    <DialogRoot v-model:open="drawer">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-40 bg-surface-950/40 lg:hidden" />
        <DialogContent
          :aria-describedby="undefined"
          class="fixed inset-y-0 right-0 z-50 flex w-80 max-w-[90vw] flex-col bg-surface-0 shadow-xl focus:outline-hidden lg:hidden dark:bg-surface-900 dark:text-gray-200"
        >
          <div
            class="flex items-center gap-2 border-b border-surface-200 p-4 dark:border-surface-700"
          >
            <DialogTitle class="mr-auto text-lg font-semibold">
              {{
                count
                  ? t('discover.filtersCount', { n: count })
                  : t('discover.filters')
              }}
            </DialogTitle>
            <AppButton
              v-if="count"
              severity="ghost"
              size="sm"
              icon="pi pi-filter-slash"
              :label="t('discover.clear')"
              @click="clear"
            />
            <DialogClose as-child>
              <AppButton
                severity="ghost"
                icon="pi pi-times"
                :aria-label="t('discover.closeFilters')"
              />
            </DialogClose>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <DiscoverFilters
              :choice="choice"
              :filters="filters"
              :failed="filtersFailed"
              :region="region"
              :count="count"
              id-prefix="drawer"
              sorting
              @change="change"
              @clear="clear"
              @retry="retryFilters"
            />
          </div>

          <div class="border-t border-surface-200 p-4 dark:border-surface-700">
            <DialogClose as-child>
              <AppButton
                class="w-full justify-center"
                :label="results.length ? showCount : t('discover.closeFilters')"
              />
            </DialogClose>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
