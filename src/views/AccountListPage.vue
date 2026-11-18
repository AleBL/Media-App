<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { TMDB_PAGE_SIZE, type TitleList } from '@shared/api';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppLoadMore from '@/components/ui/AppLoadMore.vue';
  import AppSegmented from '@/components/ui/AppSegmented.vue';
  import AppState from '@/components/ui/AppState.vue';
  import PosterCardSkeleton from '@/components/Home/PosterCardSkeleton.vue';
  import PosterCard from '@/components/Home/PosterCard.vue';
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
  const hasMore = computed(
    () => view.value.page * TMDB_PAGE_SIZE < view.value.totalResults,
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

  const kinds = computed(() =>
    TYPES.map((type) => ({ value: type.value, label: t(type.label) })),
  );
  // Movies or tv shows: another kind starts again from its first page.
  const kind = computed({
    get: () => view.value.type,
    set: (value: string) =>
      void lists.load(props.list, value as (typeof TYPES)[number]['value']),
  });

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

    <div class="mb-2 flex justify-center">
      <AppSegmented
        v-model="kind"
        :options="kinds"
        :label="t('lists.kind')"
        :name="`${list}-type`"
      />
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
      <!-- Asked again, in another language: the list stays readable. -->
      <AppLoadingBar v-if="view.loading" class="my-1" />

      <ul class="page card-grid list-none py-4">
        <li v-for="item in view.results" :key="item.id">
          <PosterCard :item="item" grid />
        </li>
      </ul>

      <AppLoadMore
        :loading="view.loadingMore"
        :failed="view.moreFailed"
        :has-more="hasMore"
        @more="lists.loadMore(list)"
      />
    </div>

    <AppState v-else-if="view.loaded && !view.loading" :icon="icon">
      {{ t(empty) }}
    </AppState>

    <!-- The shape of the list until it comes; the text is for screen
         readers. -->
    <div v-else role="status" class="page card-grid py-4">
      <span class="sr-only">{{ t('lists.loading') }}</span>
      <PosterCardSkeleton v-for="index in 12" :key="index" />
    </div>
  </div>
</template>
