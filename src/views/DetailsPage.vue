<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { storeToRefs } from 'pinia';
  import type { MediaType, WatchProvider } from '@shared/api';
  import AccountButtons from '@/components/Account/AccountButtons.vue';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppImage from '@/components/ui/AppImage.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppSkeleton from '@/components/ui/AppSkeleton.vue';
  import AppState from '@/components/ui/AppState.vue';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';
  import { useDetailsStore } from '@/stores/details';
  import { accessProblem } from '@/util/access';
  import { logoUrl, posterUrl, profileUrl } from '@/util/images';

  const props = defineProps<{ type: MediaType; id: number }>();

  const { t, locale } = useI18n();
  const router = useRouter();
  const store = useDetailsStore();
  const credentials = useCredentialsStore();
  const { details, region, loading, error } = storeToRefs(store);
  const desktop = isDesktop();

  // Asked again in the new language when it changes: TMDB translates the
  // title, the overview and the genres.
  watch(
    [() => props.type, () => props.id, locale],
    () => store.load(props.type, props.id),
    { immediate: true },
  );

  const problem = computed(() =>
    accessProblem(error.value?.code, desktop, credentials.hasKey),
  );

  const errorMessage = computed(() => {
    if (error.value?.code === 'not-found') {
      return 'details.notFound';
    }

    if (!problem.value) {
      return 'details.error';
    }

    return problem.value === 'webUnavailable'
      ? 'details.errorWebUnavailable'
      : `access.${problem.value}`;
  });

  const canRetry = computed(
    () => !problem.value && error.value?.code !== 'not-found',
  );

  // Back to where the user came from, usually the results of a search. A
  // page opened by its address has nowhere to go back to.
  function back() {
    if (router.options.history.state.back) {
      router.back();
    } else {
      router.push({ name: 'search' });
    }
  }

  const year = computed(() => details.value?.date?.slice(0, 4));

  // The date as TMDB sends it (YYYY-MM-DD), written the way of the language.
  // Read as UTC on both ends, so no timezone moves it to another day.
  const date = computed(() => {
    const value = details.value?.date;

    if (!value) {
      return null;
    }

    const [y, m, d] = value.split('-').map(Number);
    const text = new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(Date.UTC(y, m - 1, d));

    return t(
      details.value?.type === 'tv' ? 'details.firstAired' : 'details.released',
      { date: text },
    );
  });

  const runtime = computed(() => {
    const minutes = details.value?.runtime;

    if (!minutes) {
      return null;
    }

    const text =
      minutes < 60
        ? t('details.minutes', { minutes })
        : t('details.hoursMinutes', {
            hours: Math.floor(minutes / 60),
            minutes: minutes % 60,
          });

    return details.value?.type === 'tv'
      ? t('details.perEpisode', { runtime: text })
      : text;
  });

  const facts = computed(() => {
    const value = details.value;

    if (!value) {
      return [];
    }

    return [
      date.value,
      runtime.value,
      value.seasons ? t('details.seasons', value.seasons) : null,
      value.episodes ? t('details.episodes', value.episodes) : null,
      value.genres.map((genre) => genre.name).join(', ') || null,
    ].filter((fact): fact is string => !!fact);
  });

  const rating = computed(() => {
    const { voteAverage, voteCount } = details.value ?? {};

    if (!voteAverage || !voteCount) {
      return null;
    }

    return {
      average: voteAverage.toFixed(1),
      votes: t(
        'details.votes',
        { count: new Intl.NumberFormat(locale.value).format(voteCount) },
        voteCount,
      ),
    };
  });

  const trailerUrl = computed(() =>
    details.value?.trailer
      ? `https://www.youtube.com/watch?v=${details.value.trailer.key}`
      : null,
  );

  const imdbUrl = computed(() =>
    details.value?.imdbId
      ? `https://www.imdb.com/title/${details.value.imdbId}/`
      : null,
  );

  const regionName = computed(() => {
    try {
      return (
        new Intl.DisplayNames([locale.value], { type: 'region' }).of(
          region.value,
        ) ?? region.value
      );
    } catch {
      return region.value;
    }
  });

  const watchGroups = computed(() => {
    const watch = details.value?.watch;

    if (!watch) {
      return [];
    }

    const groups: { key: string; providers: WatchProvider[] }[] = [
      { key: 'stream', providers: watch.stream },
      { key: 'free', providers: watch.free },
      { key: 'rent', providers: watch.rent },
      { key: 'buy', providers: watch.buy },
    ];

    return groups.filter((group) => group.providers.length > 0);
  });
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 pb-10">
    <div class="my-4">
      <AppButton
        :label="t('details.back')"
        icon="pi pi-arrow-left"
        severity="secondary"
        @click="back"
      />
    </div>

    <AppState
      v-if="error"
      tone="error"
      :icon="
        error.code === 'not-found'
          ? 'pi pi-question-circle'
          : 'pi pi-exclamation-triangle'
      "
    >
      {{ t(errorMessage) }}
      <template #actions>
        <RouterLink v-if="problem && desktop" :to="{ name: 'settings' }">
          {{ t('access.openSettings') }}
        </RouterLink>
        <AppButton
          v-else-if="canRetry"
          :label="t('details.tryAgain')"
          icon="pi pi-refresh"
          @click="store.load(type, id)"
        />
      </template>
    </AppState>

    <!-- The shape of the page until it comes; the text is for screen
         readers. -->
    <div
      v-else-if="!details"
      role="status"
      class="flex flex-col gap-6 sm:flex-row"
    >
      <span class="sr-only">{{ t('details.loading') }}</span>
      <AppSkeleton
        class="aspect-[2/3] w-48 self-center sm:w-64 sm:self-start"
      />
      <div class="flex-1">
        <AppSkeleton class="h-9 w-2/3" />
        <AppSkeleton class="mt-3 h-5 w-1/2" />
        <AppSkeleton class="mt-3 h-4 w-3/4" />
        <AppSkeleton class="mt-6 h-4 w-full" />
        <AppSkeleton class="mt-3 h-4 w-full" />
        <AppSkeleton class="mt-3 h-4 w-5/6" />
      </div>
    </div>

    <article v-else :aria-busy="loading" aria-labelledby="details-title">
      <!-- In another language, on its way: the page stays readable. -->
      <AppLoadingBar v-if="loading" class="mb-3" />

      <div class="flex flex-col gap-6 sm:flex-row">
        <AppImage
          :src="posterUrl(details.posterPath)"
          eager
          class="w-48 shrink-0 self-center rounded-md shadow-md sm:w-64 sm:self-start"
        />

        <div class="flex-1">
          <h1 id="details-title" class="text-3xl font-semibold">
            {{ details.title }}
            <span
              v-if="year"
              class="font-normal text-surface-500 dark:text-surface-400"
              >({{ year }})</span
            >
          </h1>
          <p
            v-if="details.originalTitle"
            class="mt-1 text-surface-500 dark:text-surface-400"
          >
            {{ details.originalTitle }}
          </p>
          <p v-if="details.tagline" class="mt-3 italic">
            {{ details.tagline }}
          </p>

          <ul
            v-if="facts.length"
            class="mt-4 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-sm text-surface-600 dark:text-surface-300"
          >
            <li
              v-for="(fact, index) in facts"
              :key="fact"
              class="flex items-center gap-3"
            >
              <span v-if="index > 0" aria-hidden="true">·</span>
              {{ fact }}
            </li>
          </ul>

          <p v-if="rating" class="mt-4 flex items-center gap-2">
            <i class="pi pi-star-fill text-yellow-500" aria-hidden="true" />
            <span class="text-lg font-semibold">{{ rating.average }}</span>
            <span class="text-sm text-surface-500 dark:text-surface-400"
              >({{ rating.votes }})</span
            >
          </p>

          <p v-if="details.overview" class="mt-4 leading-relaxed">
            {{ details.overview }}
          </p>

          <AccountButtons :id="details.id" class="mt-6" :type="details.type" />

          <div v-if="trailerUrl || imdbUrl" class="mt-4 flex flex-wrap gap-3">
            <AppButton
              v-if="trailerUrl"
              :href="trailerUrl"
              :label="t('details.trailer')"
              icon="pi pi-youtube"
            />
            <AppButton
              v-if="imdbUrl"
              :href="imdbUrl"
              :label="t('details.imdb')"
              icon="pi pi-external-link"
              severity="secondary"
            />
          </div>
        </div>
      </div>

      <section class="mt-10" aria-labelledby="watch-title">
        <h2 id="watch-title" class="text-xl font-semibold">
          {{ t('details.whereToWatch', { region: regionName }) }}
        </h2>

        <template v-if="watchGroups.length">
          <div v-for="group in watchGroups" :key="group.key" class="mt-4">
            <h3
              class="text-sm font-medium text-surface-500 dark:text-surface-400"
            >
              {{ t(`details.${group.key}`) }}
            </h3>
            <ul class="mt-2 flex list-none flex-wrap gap-3 p-0">
              <li v-for="provider in group.providers" :key="provider.id">
                <AppImage
                  v-if="provider.logoPath"
                  :src="logoUrl(provider.logoPath)"
                  :alt="provider.name"
                  :title="provider.name"
                  shape="square"
                  class="h-12 w-12 rounded-lg"
                />
                <span
                  v-else
                  class="flex h-12 items-center rounded-lg bg-surface-100 px-3 text-sm dark:bg-surface-700"
                >
                  {{ provider.name }}
                </span>
              </li>
            </ul>
          </div>
        </template>
        <p v-else class="mt-2 text-surface-500 dark:text-surface-400">
          {{ t('details.nowhereToWatch', { region: regionName }) }}
        </p>

        <!-- TMDB only lets the app show this data with its source named. -->
        <p class="mt-4 text-sm text-surface-500 dark:text-surface-400">
          {{ t('details.justWatch') }}
          <a
            v-if="details.watch?.link"
            :href="details.watch.link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('details.allOptions') }}
          </a>
        </p>
      </section>

      <section
        v-if="details.cast.length"
        class="mt-10"
        aria-labelledby="cast-title"
      >
        <h2 id="cast-title" class="text-xl font-semibold">
          {{ t('details.cast') }}
        </h2>
        <ul
          class="mt-4 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-4 lg:grid-cols-6"
        >
          <li
            v-for="person in details.cast"
            :key="person.id"
            class="text-center"
          >
            <AppImage
              :src="person.profilePath ? profileUrl(person.profilePath) : null"
              icon="pi pi-user"
              class="mx-auto w-full max-w-36 rounded-md"
            />
            <p class="mt-2 text-sm font-medium">{{ person.name }}</p>
            <p
              v-if="person.character"
              class="text-xs text-surface-500 dark:text-surface-400"
            >
              {{ person.character }}
            </p>
          </li>
        </ul>
      </section>
    </article>
  </div>
</template>
