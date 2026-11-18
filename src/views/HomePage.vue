<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import type { MediaList } from '@shared/api';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppState from '@/components/ui/AppState.vue';
  import PosterCard from '@/components/Home/PosterCard.vue';
  import PosterCardSkeleton from '@/components/Home/PosterCardSkeleton.vue';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';
  import { HOME_LISTS, useHomeStore } from '@/stores/home';
  import { accessProblem } from '@/util/access';

  const { t, locale } = useI18n();
  const home = useHomeStore();
  const { lists } = storeToRefs(home);
  const credentials = useCredentialsStore();
  const desktop = isDesktop();

  const TITLES: Record<MediaList, string> = {
    trending: 'homePage.trending',
    'popular-movies': 'homePage.popularMovies',
    'popular-tv': 'homePage.popularTv',
  };

  // TMDB translates the titles: the lists come again in the new language.
  watch(locale, () => home.load(), { immediate: true });

  // Without access to TMDB every list fails the same way: one message for
  // all of them, instead of one in each.
  const problem = computed(() => {
    const failed = HOME_LISTS.map((list) => lists.value[list].error).find(
      (error) => error !== null,
    );

    return accessProblem(failed?.code, desktop, credentials.hasKey);
  });
</script>

<template>
  <div class="text-center my-5">
    <h1 class="mb-3 text-2xl">
      {{ t('pageTitles.home') }}
    </h1>
  </div>

  <div class="mx-auto max-w-xl px-4 pb-4 text-center">
    <p class="mb-4">{{ t('homePage.intro') }}</p>
    <RouterLink
      :to="{ name: 'search' }"
      class="inline-flex items-center gap-2 rounded-md bg-primary-500 px-4 py-2 font-semibold text-white no-underline hover:bg-primary-600"
    >
      <span class="pi pi-search" aria-hidden="true" />
      {{ t('homePage.startSearching') }}
    </RouterLink>
  </div>

  <div class="mx-auto max-w-6xl px-4 pb-10">
    <AppState v-if="problem" tone="error" icon="pi pi-exclamation-triangle">
      {{
        t(
          problem === 'webUnavailable'
            ? 'homePage.listsUnavailable'
            : `access.${problem}`,
        )
      }}
      <template v-if="desktop" #actions>
        <RouterLink :to="{ name: 'settings' }">
          {{ t('access.openSettings') }}
        </RouterLink>
      </template>
    </AppState>

    <template v-else>
      <section
        v-for="list in HOME_LISTS"
        :key="list"
        class="mt-8"
        :aria-labelledby="`list-${list}`"
      >
        <h2 :id="`list-${list}`" class="text-xl font-semibold">
          {{ t(TITLES[list]) }}
        </h2>

        <div
          v-if="lists[list].error"
          role="alert"
          class="mt-3 flex flex-wrap items-center gap-3 text-red-600 dark:text-red-400"
        >
          <p>{{ t('homePage.listError') }}</p>
          <AppButton
            :label="t('homePage.tryAgain')"
            icon="pi pi-refresh"
            severity="secondary"
            @click="home.loadList(list)"
          />
        </div>

        <!-- The shape of the row until it comes; the text is for screen
             readers. -->
        <div
          v-else-if="!lists[list].items.length && lists[list].loading"
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

        <template v-else>
          <!-- Loading again, in another language: the row stays. -->
          <AppLoadingBar v-if="lists[list].loading" class="mt-3" />

          <!-- Scrolls sideways; the cards snap into place. -->
          <ul
            class="mt-4 flex snap-x list-none gap-4 overflow-x-auto p-0 pb-3"
            :aria-busy="lists[list].loading"
          >
            <li
              v-for="item in lists[list].items"
              :key="`${item.media_type}-${item.id}`"
              class="shrink-0 snap-start"
            >
              <PosterCard :item="item" />
            </li>
          </ul>
        </template>
      </section>
    </template>
  </div>
</template>
