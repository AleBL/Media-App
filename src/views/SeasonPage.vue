<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { storeToRefs } from 'pinia';
  import type { Episode, WatchedEpisodes } from '@shared/api';
  import SeasonSwitcher from '@/components/Details/SeasonSwitcher.vue';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppImage from '@/components/ui/AppImage.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppSkeleton from '@/components/ui/AppSkeleton.vue';
  import AppState from '@/components/ui/AppState.vue';
  import AppToggleButton from '@/components/ui/AppToggleButton.vue';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';
  import { useDetailsStore } from '@/stores/details';
  import { useEpisodesStore } from '@/stores/episodes';
  import { useSeasonStore } from '@/stores/season';
  import { useSessionStore } from '@/stores/session';
  import { useToastsStore } from '@/stores/toasts';
  import { today, useWatchedStore } from '@/stores/watched';
  import { accessProblem } from '@/util/access';
  import { posterUrl, stillUrl } from '@/util/images';
  import { airedCounts, upTo, watchedOf, withEpisodes } from '@/util/progress';
  import { useShowProgress } from '@/util/showProgress';

  const props = defineProps<{ id: number; season: number }>();

  const { t, locale } = useI18n();
  const router = useRouter();
  const store = useSeasonStore();
  const show = useDetailsStore();
  const credentials = useCredentialsStore();
  const { season: current, loading, error } = storeToRefs(store);
  const desktop = isDesktop();

  // Asked again in the new language when it changes: TMDB translates the
  // names and the synopses.
  watch(
    [() => props.id, () => props.season, locale],
    () => store.load(props.id, props.season),
    { immediate: true },
  );

  // The show, for its name and its other seasons. Coming from its page, it
  // is there already.
  let showLanguage = locale.value;

  watch(
    [() => props.id, locale],
    ([id, language]) => {
      const same = show.details?.type === 'tv' && show.details.id === id;

      if (!same || language !== showLanguage) {
        showLanguage = language;
        void show.load('tv', id);
      }
    },
    { immediate: true },
  );

  const showDetails = computed(() =>
    show.details?.type === 'tv' && show.details.id === props.id
      ? show.details
      : null,
  );

  const showPage = computed(() => ({
    name: 'details',
    params: { type: 'tv', id: props.id },
  }));

  const problem = computed(() =>
    accessProblem(error.value?.code, desktop, credentials.hasKey),
  );

  const errorMessage = computed(() => {
    if (error.value?.code === 'not-found') {
      return 'season.notFound';
    }

    if (!problem.value) {
      return 'season.error';
    }

    return problem.value === 'webUnavailable'
      ? 'details.errorWebUnavailable'
      : `access.${problem.value}`;
  });

  const canRetry = computed(
    () => !problem.value && error.value?.code !== 'not-found',
  );

  // Back to where the user came from, usually the page of the show. A page
  // opened by its address goes to the show.
  function back() {
    if (router.options.history.state.back) {
      router.back();
    } else {
      void router.push(showPage.value);
    }
  }

  // The seasons of the show in its order, the specials last.
  const seasons = computed(() => showDetails.value?.seasonList ?? []);

  // A day as TMDB sends it (YYYY-MM-DD), written the way of the language,
  // read as UTC on both ends so no timezone moves it to another day.
  function longDate(day: string) {
    const [year, month, date] = day.split('-').map(Number);

    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(Date.UTC(year, month - 1, date));
  }

  const facts = computed(() => {
    const value = current.value;

    if (!value) {
      return [];
    }

    return [
      value.airDate?.slice(0, 4),
      value.episodes.length
        ? t('details.episodes', value.episodes.length)
        : null,
    ].filter((fact): fact is string => !!fact);
  });

  // "S1 E2 · Cat's in the Bag...", or the number alone.
  const titleOf = (episode: Episode) =>
    `${t('season.code', { season: props.season, episode: episode.number })} · ${
      episode.name ?? t('season.episode', { n: episode.number })
    }`;

  function aboutEpisode(episode: Episode) {
    const coming = episode.airDate && episode.airDate > today();

    return [
      episode.airDate &&
        (coming
          ? t('season.premieres', { date: longDate(episode.airDate) })
          : longDate(episode.airDate)),
      episode.runtime && t('details.minutes', { minutes: episode.runtime }),
    ].filter((part): part is string => !!part);
  }

  // What the user watched: each episode out by now can be marked, the
  // season at once, or every episode up to one.
  const route = useRoute();
  const session = useSessionStore();
  const episodes = useEpisodesStore();
  const watched = useWatchedStore();
  const toasts = useToastsStore();
  const watchedSeasons = useShowProgress(() => showDetails.value);
  const marked = computed(() => new Set(watchedSeasons.value?.[props.season]));

  /** Out by now: by its date, or without one, by the last episode aired. */
  function isOut(episode: Episode) {
    const last = showDetails.value?.lastEpisode;

    if (episode.airDate) {
      return episode.airDate <= today();
    }

    return (
      !!last &&
      last.season !== 0 &&
      (props.season < last.season ||
        (props.season === last.season && episode.number <= last.number))
    );
  }

  const out = computed(() => current.value?.episodes.filter(isOut) ?? []);
  const watchedHere = computed(
    () =>
      out.value.filter((episode) => marked.value.has(episode.number)).length,
  );
  const seasonDone = computed(
    () => out.value.length > 0 && watchedHere.value === out.value.length,
  );

  // "Up to here" changes something from the first episode not watched on,
  // or anywhere while a season before has one.
  const firstMissing = computed(
    () =>
      out.value.find((episode) => !marked.value.has(episode.number))?.number ??
      Infinity,
  );
  const seasonsBeforeDone = computed(() => {
    const details = showDetails.value;

    return (
      props.season === 0 ||
      !details ||
      Object.entries(airedCounts(details)).every(
        ([number, count]) =>
          Number(number) >= props.season ||
          watchedOf(watchedSeasons.value ?? {}, Number(number), count) ===
            count,
      )
    );
  });

  const changesUpTo = (episode: Episode) =>
    !seasonsBeforeDone.value || episode.number >= firstMissing.value;

  const codeOf = (episode: Episode) =>
    t('season.code', { season: props.season, episode: episode.number });

  const seasonName = computed(
    () => current.value?.name || t('season.number', { n: props.season }),
  );

  // A change TMDB did not take; nothing to say when the page says it
  // otherwise (signed out, or the v4 login is missing).
  const saveFailed = ref(false);
  const told = (code: string) =>
    code === 'signed-out' || code === 'sign-in-again';

  async function save(next: WatchedEpisodes, notice?: string) {
    const details = showDetails.value;
    const before = details && episodes.snapshot(details);

    if (!details || !before) {
      return;
    }

    saveFailed.value = false;

    const answer = await episodes.change(details, next);

    if (answer?.ok && notice) {
      // Many episodes at once: said in a notice, with a way back.
      toasts.show(notice, {
        label: t('toast.undo'),
        run: () => void episodes.restore(details, before),
      });
    } else if (answer && !answer.ok && !told(answer.error.code)) {
      saveFailed.value = true;
    }
  }

  function toggleEpisode(episode: Episode) {
    if (watchedSeasons.value) {
      void save(
        withEpisodes(
          watchedSeasons.value,
          props.season,
          [episode.number],
          !marked.value.has(episode.number),
        ),
      );
    }
  }

  function toggleSeason() {
    if (watchedSeasons.value) {
      const done = seasonDone.value;

      void save(
        withEpisodes(
          watchedSeasons.value,
          props.season,
          out.value.map((episode) => episode.number),
          !done,
        ),
        t(done ? 'season.unmarkedSeason' : 'season.markedSeason', {
          season: seasonName.value,
        }),
      );
    }
  }

  function markUpTo(episode: Episode) {
    if (watchedSeasons.value && showDetails.value) {
      void save(
        upTo(
          showDetails.value,
          watchedSeasons.value,
          props.season,
          out.value
            .filter((one) => one.number <= episode.number)
            .map((one) => one.number),
        ),
        t('season.markedUpTo', { episode: codeOf(episode) }),
      );
    }
  }
</script>

<template>
  <div class="pb-10">
    <div class="page my-4">
      <AppButton
        :label="showDetails?.title ?? t('details.back')"
        :aria-label="
          showDetails
            ? t('season.backTo', { show: showDetails.title })
            : undefined
        "
        icon="pi pi-arrow-left"
        severity="ghost"
        class="-ml-3"
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
          @click="store.load(id, props.season)"
        />
        <RouterLink v-else :to="showPage">
          {{ t('season.toShow') }}
        </RouterLink>
      </template>
    </AppState>

    <!-- The shape of the page until it comes; the text is for screen
         readers. -->
    <div v-else-if="!current" role="status" class="page">
      <span class="sr-only">{{ t('details.loading') }}</span>
      <div class="flex flex-col gap-6 sm:flex-row">
        <AppSkeleton class="aspect-[2/3] w-40 self-center sm:self-start" />
        <div class="flex-1">
          <AppSkeleton class="h-4 w-1/4" />
          <AppSkeleton class="mt-3 h-9 w-1/2" />
          <AppSkeleton class="mt-4 h-4 w-full" />
          <AppSkeleton class="mt-2 h-4 w-5/6" />
        </div>
      </div>
      <div class="mt-10 flex flex-col gap-3">
        <AppSkeleton v-for="index in 4" :key="index" class="h-28 w-full" />
      </div>
    </div>

    <article v-else :aria-busy="loading" aria-labelledby="season-title">
      <div class="page">
        <!-- In another language, on its way: the page stays readable. -->
        <AppLoadingBar v-if="loading" class="mb-3" />

        <div
          class="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)] 2xl:grid-cols-[14rem_minmax(0,1fr)]"
        >
          <AppImage
            :src="
              current.posterPath ? posterUrl(current.posterPath, 'w342') : null
            "
            eager
            class="w-40 self-start justify-self-center rounded-md shadow-lg ring-1 ring-black/5 sm:w-full"
          />

          <div class="min-w-0">
            <p v-if="showDetails" class="text-sm font-medium">
              <RouterLink :to="showPage">{{ showDetails.title }}</RouterLink>
            </p>
            <h1 id="season-title" class="mt-1 text-3xl font-semibold">
              {{ current.name || t('season.number', { n: current.number }) }}
            </h1>
            <p
              v-if="facts.length"
              class="mt-2 text-sm text-surface-600 dark:text-surface-300"
            >
              {{ facts.join(' · ') }}
            </p>

            <template v-if="current.overview">
              <p
                class="mt-4 max-w-[80ch] leading-relaxed"
                :lang="current.overviewLanguage"
              >
                {{ current.overview }}
              </p>
              <p
                v-if="current.overviewLanguage"
                class="mt-1 text-xs text-surface-500 dark:text-surface-400"
              >
                {{ t('season.overviewInEnglish') }}
              </p>
            </template>

            <!-- What the user watched of the season, and all of it at once.
                 Marking needs the v4 login, like the watched titles. -->
            <div
              v-if="session.account && !watched.needsSignIn && out.length"
              class="mt-5 flex flex-wrap items-center gap-3"
            >
              <AppButton
                size="sm"
                :severity="seasonDone ? 'secondary' : 'primary'"
                :icon="seasonDone ? 'pi pi-eye-slash' : 'pi pi-check'"
                :label="
                  t(seasonDone ? 'season.unmarkSeason' : 'season.markSeason')
                "
                :disabled="!watchedSeasons"
                @click="toggleSeason"
              />
              <p v-if="watchedSeasons" class="text-sm font-medium">
                {{
                  t('season.progress', {
                    watched: watchedHere,
                    out: out.length,
                  })
                }}
              </p>
            </div>
            <p
              v-if="saveFailed"
              role="alert"
              class="mt-2 text-sm text-red-600 dark:text-red-400"
            >
              {{ t('lists.saveFailed') }}
            </p>
            <p
              v-if="session.account && episodes.error && !watched.needsSignIn"
              role="alert"
              class="mt-2 flex flex-wrap items-center gap-2 text-sm text-red-600 dark:text-red-400"
            >
              {{ t('season.progressFailed') }}
              <AppButton
                severity="ghost"
                size="sm"
                icon="pi pi-refresh"
                :label="t('details.tryAgain')"
                @click="episodes.load()"
              />
            </p>
            <p
              v-if="session.account && watched.needsSignIn"
              class="mt-4 text-sm"
            >
              {{ t('lists.signInAgain') }}
              <RouterLink :to="{ name: 'account' }">
                {{ t('pageTitles.account') }}
              </RouterLink>
            </p>
            <p v-else-if="!session.account" class="mt-4 text-sm">
              <RouterLink
                :to="{ name: 'account', query: { next: route.fullPath } }"
              >
                {{ t('season.signInToMark') }}
              </RouterLink>
            </p>

            <SeasonSwitcher
              v-if="seasons.length > 1"
              class="mt-6"
              :show-id="id"
              :season="season"
              :seasons="seasons"
              :show="showDetails?.title"
            />
          </div>
        </div>
      </div>

      <section class="page mt-10" aria-labelledby="episodes-title">
        <h2 id="episodes-title" class="text-xl font-semibold">
          {{ t('season.episodes') }}
        </h2>
        <p
          v-if="!current.episodes.length"
          class="mt-2 text-surface-500 dark:text-surface-400"
        >
          {{ t('season.noEpisodes') }}
        </p>
        <ol v-else class="m-0 mt-3 flex list-none flex-col gap-3 p-0">
          <li
            v-for="episode in current.episodes"
            :key="episode.number"
            class="flex flex-col gap-4 rounded-lg border border-surface-200 p-3 sm:flex-row dark:border-surface-700"
          >
            <AppImage
              :src="episode.stillPath ? stillUrl(episode.stillPath) : null"
              shape="video"
              icon="pi pi-video"
              class="w-full shrink-0 rounded-md sm:w-48"
            />
            <div class="min-w-0 flex-1">
              <h3 class="font-medium">{{ titleOf(episode) }}</h3>
              <p
                class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-surface-600 dark:text-surface-300"
              >
                <span v-for="part in aboutEpisode(episode)" :key="part">
                  {{ part }}
                </span>
                <span v-if="episode.voteAverage" class="inline-flex gap-1">
                  <span
                    class="pi pi-star-fill text-yellow-500"
                    aria-hidden="true"
                  />
                  <span class="sr-only">{{ t('season.rating') }}</span>
                  {{ episode.voteAverage.toFixed(1) }}
                </span>
                <span
                  v-if="episode.finale"
                  class="rounded-sm bg-primary-50 px-1.5 py-0.5 text-xs font-semibold text-primary-800 dark:bg-primary-950 dark:text-primary-200"
                >
                  {{ t('season.finale') }}
                </span>
              </p>
              <template v-if="episode.overview">
                <p
                  class="mt-2 max-w-[80ch] text-sm leading-relaxed"
                  :lang="episode.overviewLanguage"
                >
                  {{ episode.overview }}
                </p>
                <p
                  v-if="episode.overviewLanguage"
                  class="mt-1 text-xs text-surface-500 dark:text-surface-400"
                >
                  {{ t('season.overviewInEnglish') }}
                </p>
              </template>
              <!-- Toggle buttons: the name stays, aria-pressed says whether
                   it was watched. An episode to come has none. -->
              <div
                v-if="session.account && !watched.needsSignIn && isOut(episode)"
                class="mt-3 flex flex-wrap gap-2"
              >
                <AppToggleButton
                  size="sm"
                  :label="t('season.watched')"
                  :aria-label="
                    t('season.watchedEpisode', { episode: codeOf(episode) })
                  "
                  icon="pi pi-eye"
                  pressed-icon="pi pi-check-circle"
                  :pressed="
                    watchedSeasons ? marked.has(episode.number) : undefined
                  "
                  :disabled="!watchedSeasons"
                  @click="toggleEpisode(episode)"
                />
                <AppButton
                  v-if="watchedSeasons && changesUpTo(episode)"
                  severity="ghost"
                  size="sm"
                  icon="pi pi-angle-double-up"
                  :label="t('season.upTo')"
                  :aria-label="
                    t('season.upToLabel', { episode: codeOf(episode) })
                  "
                  @click="markUpTo(episode)"
                />
              </div>
            </div>
          </li>
        </ol>
      </section>
    </article>
  </div>
</template>
