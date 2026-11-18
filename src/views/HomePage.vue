<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { storeToRefs } from 'pinia';
  import type { MediaList } from '@shared/api';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppState from '@/components/ui/AppState.vue';
  import PosterCardSkeleton from '@/components/Home/PosterCardSkeleton.vue';
  import PosterRow from '@/components/Home/PosterRow.vue';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';
  import { HOME_LISTS, useHomeStore } from '@/stores/home';
  import { accessProblem } from '@/util/access';

  const { t, locale } = useI18n();
  const router = useRouter();
  const home = useHomeStore();

  // Straight to the results of what was typed, kept in the address.
  const text = ref('');

  function search() {
    const query = text.value.trim();

    void router.push({ name: 'search', query: query ? { q: query } : {} });
  }
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
  <!-- The search first: what most visits come for. -->
  <div class="page pt-10 pb-4 text-center">
    <h1 class="page-title text-3xl sm:text-4xl">
      {{ t('homePage.title') }}
    </h1>
    <p class="mx-auto mt-3 max-w-xl text-surface-600 dark:text-surface-300">
      {{ t('homePage.intro') }}
    </p>
    <form
      role="search"
      class="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2"
      @submit.prevent="search"
    >
      <div class="relative min-w-0 flex-1 basis-64">
        <span
          class="pi pi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500"
          aria-hidden="true"
        />
        <input
          v-model="text"
          type="search"
          class="field w-full py-2.5 pl-10 [&::-webkit-search-cancel-button]:appearance-none"
          :placeholder="t('homePage.searchPlaceholder')"
          :aria-label="t('pageTitles.search')"
        />
      </div>
      <AppButton
        type="submit"
        class="h-11"
        icon="pi pi-search"
        :label="t('homePage.startSearching')"
      />
    </form>
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

          <PosterRow :items="lists[list].items" :busy="lists[list].loading" />
        </template>
      </section>
    </template>
  </div>
</template>
