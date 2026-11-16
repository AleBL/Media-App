<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { TMDB_PAGE_SIZE, type AccountList } from '@shared/api';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppPaginator from '@/components/ui/AppPaginator.vue';
  import SearchItemCard from '@/components/Search/SearchItemCard.vue';
  import { useAccountListsStore } from '@/stores/accountLists';
  import { useGenresStore } from '@/stores/genres';
  import { useSessionStore } from '@/stores/session';
  import { MEDIA_TYPES } from '@/util/constants';

  const props = defineProps<{ list: AccountList }>();

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
  const heading = computed(() =>
    props.list === 'watchlist' ? 'lists.watchlist' : 'lists.favorites',
  );
  const empty = computed(() =>
    props.list === 'watchlist'
      ? 'lists.emptyWatchlist'
      : 'lists.emptyFavorites',
  );

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

    <div
      v-if="view.error && view.error.code !== 'signed-out'"
      role="alert"
      class="p-5 text-center text-red-600 dark:text-red-400"
    >
      <p>{{ t('lists.error') }}</p>
      <AppButton
        class="mt-4"
        :label="t('lists.tryAgain')"
        icon="pi pi-refresh"
        @click="lists.load(list)"
      />
    </div>

    <div
      v-else-if="view.results.length"
      :class="{ 'opacity-50': view.loading }"
      :aria-busy="view.loading"
    >
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

    <div v-else-if="view.loaded && !view.loading" class="p-5 text-center">
      {{ t(empty) }}
    </div>

    <div v-else role="status" class="p-5 text-center">
      {{ t('lists.loading') }}
    </div>
  </div>
</template>
