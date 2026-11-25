<script setup lang="ts">
  import { computed, onBeforeMount, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import type { MediaType } from '@shared/api';
  import ContinueRow from '@/components/Home/ContinueRow.vue';
  import ForYouRow from '@/components/Home/ForYouRow.vue';
  import HomeRow from '@/components/Home/HomeRow.vue';
  import HomeRowsEditor from '@/components/Home/HomeRowsEditor.vue';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppSegmented from '@/components/ui/AppSegmented.vue';
  import AppState from '@/components/ui/AppState.vue';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';
  import { useGenresStore } from '@/stores/genres';
  import { useHomeStore } from '@/stores/home';
  import { rowId, rowType, useHomeRowsStore } from '@/stores/homeRows';
  import { accessProblem } from '@/util/access';

  const { t, locale } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const home = useHomeStore();
  const homeRows = useHomeRowsStore();
  const genres = useGenresStore();
  const credentials = useCredentialsStore();
  const desktop = isDesktop();

  // Straight to the results of what was typed, kept in the address.
  const text = ref('');

  function search() {
    const query = text.value.trim();

    void router.push({ name: 'search', query: query ? { q: query } : {} });
  }

  // The names of the genres, in the titles of the rows and on the cards.
  watch(locale, () => genres.load(locale.value), { immediate: true });

  // The user may be coming back from the settings, where the key changed:
  // the rows that failed are asked again.
  onBeforeMount(() => home.forgetFailures());

  // Without access to TMDB every row fails the same way: one message for
  // all of them, instead of one in each.
  const problem = computed(() =>
    accessProblem(home.failure?.code, desktop, credentials.hasKey),
  );

  // Everything, the movies or the tv shows, in the address
  // (#/home?type=tv), so coming back from a title finds the same rows.
  const kind = computed({
    get: (): MediaType | 'all' =>
      route.query.type === 'movie' || route.query.type === 'tv'
        ? route.query.type
        : 'all',
    set: (value: string) =>
      void router.replace({ query: value === 'all' ? {} : { type: value } }),
  });

  const kindOptions = computed(() => [
    { value: 'all', label: t('search.all') },
    { value: 'movie', label: t('lists.movies') },
    { value: 'tv', label: t('lists.tvShows') },
  ]);

  // A row of both (trending) shows the titles of the kind chosen.
  const shown = computed(() =>
    homeRows.rows.filter((row) => {
      const type = rowType(row);

      return kind.value === 'all' || type === 'all' || type === kind.value;
    }),
  );

  const editing = ref(false);
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

  <div class="page pb-10">
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
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <AppSegmented
          v-if="!editing"
          v-model="kind"
          :options="kindOptions"
          :label="t('homePage.kind')"
          name="home-kind"
        />
        <h2 v-else class="text-xl font-semibold">
          {{ t('homePage.customize') }}
        </h2>
        <AppButton
          class="ml-auto"
          :severity="editing ? 'primary' : 'ghost'"
          :icon="editing ? 'pi pi-check' : 'pi pi-sliders-h'"
          :label="editing ? t('homePage.done') : t('homePage.customize')"
          :aria-expanded="editing"
          @click="editing = !editing"
        />
      </div>

      <HomeRowsEditor v-if="editing" />

      <template v-else>
        <!-- The shows in progress of the user, before the rows they chose. -->
        <ContinueRow v-if="kind !== 'movie'" />

        <!-- What TMDB recommends to the account, for whoever signed in. -->
        <ForYouRow :kind="kind" />

        <HomeRow
          v-for="row in shown"
          :key="rowId(row)"
          :row="row"
          :kind="kind"
        />

        <AppState
          v-if="!shown.length"
          icon="pi pi-th-large"
          :title="t('homePage.noRows')"
        >
          {{ t('homePage.noRowsHint') }}
          <template #actions>
            <AppButton
              severity="secondary"
              icon="pi pi-sliders-h"
              :label="t('homePage.customize')"
              @click="editing = true"
            />
          </template>
        </AppState>
      </template>
    </template>
  </div>
</template>
