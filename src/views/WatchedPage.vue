<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { TMDB_PAGE_SIZE } from '@shared/api';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppPaginator from '@/components/ui/AppPaginator.vue';
  import AppState from '@/components/ui/AppState.vue';
  import PosterCardSkeleton from '@/components/Home/PosterCardSkeleton.vue';
  import SearchItemCard from '@/components/Search/SearchItemCard.vue';
  import { useGenresStore } from '@/stores/genres';
  import { useSessionStore } from '@/stores/session';
  import { useWatchedStore } from '@/stores/watched';
  import { searchKey } from '@/util/media';

  const { t, locale } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const watched = useWatchedStore();
  const genres = useGenresStore();
  const session = useSessionStore();

  const view = computed(() => watched.view);
  const totalPages = computed(() =>
    Math.ceil(view.value.totalResults / TMDB_PAGE_SIZE),
  );
  // Told on the page instead, with what to do.
  const failed = computed(
    () =>
      view.value.error &&
      !['signed-out', 'sign-in-again'].includes(view.value.error.code),
  );

  // Asked again on every visit: the list changes on the page of a title,
  // and on the TMDB website. What was shown stays until the answer comes.
  watch(locale, () => watched.loadPage(), { immediate: true });

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
  <!-- Movies and tv shows together, as the list at TMDB keeps them: each
       card says which it is, and when it was watched. -->
  <div class="pb-6">
    <div class="my-5 text-center">
      <h1 class="mb-3 text-2xl">{{ t('lists.watched') }}</h1>
    </div>

    <p v-if="watched.needsSignIn" class="p-5 text-center">
      {{ t('lists.signInAgain') }}
      <RouterLink :to="{ name: 'account' }">
        {{ t('pageTitles.account') }}
      </RouterLink>
    </p>

    <AppState v-else-if="failed" tone="error" icon="pi pi-exclamation-triangle">
      {{ t('lists.error') }}
      <template #actions>
        <AppButton
          :label="t('lists.tryAgain')"
          icon="pi pi-refresh"
          @click="watched.loadPage()"
        />
      </template>
    </AppState>

    <div v-else-if="view.results.length" :aria-busy="view.loading">
      <!-- Another page on its way: the list stays readable. -->
      <AppLoadingBar v-if="view.loading" class="my-1" />

      <AppPaginator
        class="my-4"
        :page="view.page"
        :total-pages="totalPages"
        @change="(page) => watched.loadPage(page)"
      />

      <ul class="m-0 flex list-none flex-wrap p-0">
        <li
          v-for="item in view.results"
          :key="searchKey(item)"
          class="w-full p-2 sm:w-2/6 md:w-2/6 xl:w-1/4 2xl:w-1/5"
        >
          <SearchItemCard :item="item" show-type />
        </li>
      </ul>
    </div>

    <AppState v-else-if="view.loaded && !view.loading" icon="pi pi-eye">
      {{ t('lists.emptyWatched') }}
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
