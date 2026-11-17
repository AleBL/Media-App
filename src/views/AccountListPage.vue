<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { TMDB_PAGE_SIZE, type TitleList } from '@shared/api';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppPaginator from '@/components/ui/AppPaginator.vue';
  import AppState from '@/components/ui/AppState.vue';
  import PosterCardSkeleton from '@/components/Home/PosterCardSkeleton.vue';
  import SearchItemCard from '@/components/Search/SearchItemCard.vue';
  import { useAccountListsStore } from '@/stores/accountLists';
  import { useGenresStore } from '@/stores/genres';
  import { useSessionStore } from '@/stores/session';
  import { MEDIA_TYPES } from '@/util/constants';

  const props = defineProps<{ list: TitleList }>();

  const { t, locale } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const lists = useAccountListsStore();
  const genres = useGenresStore();
  const session = useSessionStore();

  const view = computed(() => lists.views[props.list]);
  const totalPages = computed(() =>
    Math.ceil(view.value.totalResults / TMDB_PAGE_SIZE),
  );
  const TEXTS: Record<
    TitleList,
    { heading: string; empty: string; icon: string }
  > = {
    watchlist: {
      heading: 'lists.watchlist',
      empty: 'lists.emptyWatchlist',
      icon: 'pi pi-bookmark',
    },
    favorite: {
      heading: 'lists.favorites',
      empty: 'lists.emptyFavorites',
      icon: 'pi pi-heart',
    },
    rated: {
      heading: 'lists.rated',
      empty: 'lists.emptyRated',
      icon: 'pi pi-star',
    },
  };
  const heading = computed(() => TEXTS[props.list].heading);
  const empty = computed(() => TEXTS[props.list].empty);
  const icon = computed(() => TEXTS[props.list].icon);

  const TYPES = [
    { value: MEDIA_TYPES.MOVIE, label: 'lists.movies' },
    { value: MEDIA_TYPES.TV_SHOW, label: 'lists.tvShows' },
  ] as const;

  // Asked again on every visit: the lists change on the page of a title,
  // and on the TMDB website. What was shown stays until the answer comes.
  watch([() => props.list, locale], () => lists.load(props.list), {
    immediate: true,
  });

  watch([locale, () => view.value.results], () => genres.load(locale.value), {
    immediate: true,
  });

  // Signed out here, in this window or because TMDB ended the session: to
  // the sign in, which comes back here.
  watch(
    () => session.account,
    (account) => {
      if (!account) {
        router.replace({ name: 'account', query: { next: route.fullPath } });
      }
    },
  );
</script>

<template>
  <div class="pb-6">
    <div class="my-5 text-center">
      <h1 class="mb-3 text-2xl">{{ t(heading) }}</h1>
    </div>

    <div
      role="radiogroup"
      :aria-label="t('lists.kind')"
      class="mb-2 flex flex-wrap justify-center gap-3"
    >
      <div v-for="kind in TYPES" :key="kind.value" class="flex items-center">
        <input
          :id="`${list}-${kind.value}`"
          type="radio"
          :name="`${list}-type`"
          class="h-4 w-4 accent-primary-500 dark:accent-primary-400 dark:[color-scheme:dark]"
          :value="kind.value"
          :checked="view.type === kind.value"
          @change="lists.load(list, 1, kind.value)"
        />
        <label :for="`${list}-${kind.value}`" class="ml-2">{{
          t(kind.label)
        }}</label>
      </div>
    </div>

    <AppState
      v-if="view.error && view.error.code !== 'signed-out'"
      tone="error"
      icon="pi pi-exclamation-triangle"
    >
      {{ t('lists.error') }}
      <template #actions>
        <AppButton
          :label="t('lists.tryAgain')"
          icon="pi pi-refresh"
          @click="lists.load(list)"
        />
      </template>
    </AppState>

    <div v-else-if="view.results.length" :aria-busy="view.loading">
      <!-- Another page or kind on its way: the list stays readable. -->
      <AppLoadingBar v-if="view.loading" class="my-1" />

      <AppPaginator
        class="my-4"
        :page="view.page"
        :total-pages="totalPages"
        @change="(page) => lists.load(list, page)"
      />

      <ul class="m-0 flex list-none flex-wrap p-0">
        <li
          v-for="item in view.results"
          :key="item.id"
          class="w-full p-2 sm:w-2/6 md:w-2/6 xl:w-1/4 2xl:w-1/5"
        >
          <SearchItemCard :item="item" />
        </li>
      </ul>
    </div>

    <AppState v-else-if="view.loaded && !view.loading" :icon="icon">
      {{ t(empty) }}
    </AppState>

    <!-- The shape of the list until it comes; the text is for screen
         readers. -->
    <div
      v-else
      role="status"
      class="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      <span class="sr-only">{{ t('lists.loading') }}</span>
      <PosterCardSkeleton v-for="index in 12" :key="index" />
    </div>
  </div>
</template>
