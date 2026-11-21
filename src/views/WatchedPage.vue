<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { TMDB_PAGE_SIZE } from '@shared/api';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppLoadMore from '@/components/ui/AppLoadMore.vue';
  import AppState from '@/components/ui/AppState.vue';
  import CardGrid from '@/components/Cards/CardGrid.vue';
  import CardGridSkeleton from '@/components/Cards/CardGridSkeleton.vue';
  import CardViewPicker from '@/components/Cards/CardViewPicker.vue';
  import ContinueCard from '@/components/Home/ContinueCard.vue';
  import { useGenresStore } from '@/stores/genres';
  import { useSessionStore } from '@/stores/session';
  import { useWatchedStore } from '@/stores/watched';
  import { useInProgress } from '@/util/showProgress';

  const { t, locale } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const watched = useWatchedStore();
  const genres = useGenresStore();
  const session = useSessionStore();
  const progress = useInProgress();

  const view = computed(() => watched.view);
  const hasMore = computed(
    () => view.value.page * TMDB_PAGE_SIZE < view.value.totalResults,
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

    <!-- The shows the user is watching, each with its next episode; below,
         what was watched in full. -->
    <section
      v-if="!watched.needsSignIn && progress.list.length"
      class="page mb-8"
      aria-labelledby="in-progress-title"
    >
      <h2 id="in-progress-title" class="text-xl font-semibold">
        {{ t('lists.inProgress') }}
      </h2>
      <ul
        class="m-0 mt-3 grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-x-4 gap-y-6 p-0"
      >
        <li v-for="entry in progress.list" :key="entry.show.id">
          <ContinueCard :entry="entry" />
        </li>
      </ul>
    </section>

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
      <!-- Asked again, in another language: the list stays readable. -->
      <AppLoadingBar v-if="view.loading" class="my-1" />

      <div class="page flex items-end justify-between gap-3 pt-2">
        <h2 v-if="progress.list.length" class="text-xl font-semibold">
          {{ t('lists.finished') }}
        </h2>
        <CardViewPicker name="watched-view" class="ml-auto" />
      </div>

      <CardGrid :items="view.results" show-type />

      <AppLoadMore
        :loading="view.loadingMore"
        :failed="view.moreFailed"
        :has-more="hasMore"
        @more="watched.loadMore()"
      />
    </div>

    <AppState
      v-else-if="view.loaded && !view.loading && !progress.list.length"
      icon="pi pi-eye"
    >
      {{ t('lists.emptyWatched') }}
    </AppState>

    <!-- The shape of the list until it comes; the text is for screen
         readers. -->
    <CardGridSkeleton
      v-else-if="!view.loaded || view.loading"
      :label="t('lists.loading')"
    />
  </div>
</template>
