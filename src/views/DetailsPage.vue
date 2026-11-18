<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { storeToRefs } from 'pinia';
  import type { MediaType, WatchProvider } from '@shared/api';
  import AccountButtons from '@/components/Account/AccountButtons.vue';
  import AgeRating from '@/components/Details/AgeRating.vue';
  import TrailerDialog from '@/components/Details/TrailerDialog.vue';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppImage from '@/components/ui/AppImage.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppScrollRow from '@/components/ui/AppScrollRow.vue';
  import AppSkeleton from '@/components/ui/AppSkeleton.vue';
  import AppState from '@/components/ui/AppState.vue';
  import AppTooltip from '@/components/ui/AppTooltip.vue';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';
  import { useDetailsStore } from '@/stores/details';
  import { accessProblem } from '@/util/access';
  import { backdropUrl, logoUrl, posterUrl, profileUrl } from '@/util/images';
  import { countryName } from '@/util/region';

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

  const imdbUrl = computed(() =>
    details.value?.imdbId
      ? `https://www.imdb.com/title/${details.value.imdbId}/`
      : null,
  );

  const regionName = computed(() => countryName(region.value, locale.value));

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

  // The page of TMDB with the links to the title on each service.
  const watchLink = computed(() => details.value?.watch?.link);

  /** What makes a link open in the browser, when there is one. */
  const outside = (href: string | undefined) =>
    href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {};
</script>

<template>
  <div class="page pb-10">
    <div class="my-4">
      <AppButton
        :label="t('details.back')"
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

      <!-- A wide still of the title, fading into the page, with the poster
           over its lower edge. Only a picture: the text stays on the page
           itself, readable in both themes. -->
      <div
        v-if="details.backdropPath"
        class="relative -mx-4 h-48 overflow-hidden sm:mx-0 sm:h-72 sm:rounded-lg 2xl:h-96"
        aria-hidden="true"
      >
        <img
          :src="backdropUrl(details.backdropPath)"
          alt=""
          class="h-full w-full object-cover"
        />
        <div
          class="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent dark:from-slate-800 dark:via-slate-800/30"
        />
      </div>

      <!-- Only the poster rises over the still; the text starts below it,
           on the page, readable in both themes. Where to watch goes under
           both, and beside them on a big screen. -->
      <div
        :class="[
          'relative grid gap-6 sm:grid-cols-[16rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)_26rem]',
          details.backdropPath && 'sm:px-6',
        ]"
      >
        <AppImage
          :src="posterUrl(details.posterPath)"
          eager
          :class="[
            'w-48 self-start justify-self-center rounded-md shadow-lg ring-1 ring-black/5 sm:w-full',
            details.backdropPath && '-mt-24 sm:-mt-40',
          ]"
        />

        <div class="min-w-0">
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
            v-if="facts.length || details.certification"
            class="mt-4 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0 text-sm text-surface-600 dark:text-surface-300"
          >
            <li v-if="details.certification" class="flex">
              <AgeRating
                :certification="details.certification"
                :region="region"
              />
            </li>
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

          <p v-if="details.overview" class="mt-4 max-w-[80ch] leading-relaxed">
            {{ details.overview }}
          </p>

          <AccountButtons :id="details.id" class="mt-6" :type="details.type" />

          <div
            v-if="details.trailer || imdbUrl"
            class="mt-4 flex flex-wrap gap-3"
          >
            <TrailerDialog
              v-if="details.trailer"
              :video-key="details.trailer.key"
              :title="details.title"
            />
            <!-- In the colors of IMDb, where it leads. -->
            <a
              v-if="imdbUrl"
              :href="imdbUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex h-9 items-center gap-2 rounded-md bg-imdb px-3.5 text-sm font-semibold text-black no-underline shadow-xs transition hover:brightness-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-surface-800"
            >
              <span class="pi pi-external-link" aria-hidden="true" />
              {{ t('details.imdb') }}
            </a>
          </div>
        </div>

        <section
          class="mt-4 sm:col-span-2 2xl:col-span-1 2xl:mt-0"
          aria-labelledby="watch-title"
        >
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
                  <!-- Each service leads to the page of TMDB, which links
                       straight to the title on each one: TMDB gives no link
                       of its own per service. The name of the service shows
                       on hover and on focus; screen readers read it from
                       the logo. -->
                  <AppTooltip
                    v-if="provider.logoPath"
                    :text="provider.name"
                    side="top"
                  >
                    <component
                      :is="watchLink ? 'a' : 'span'"
                      v-bind="outside(watchLink)"
                      class="block rounded-lg transition-shadow hover:shadow-md hover:ring-2 hover:ring-primary-500/60"
                    >
                      <AppImage
                        :src="logoUrl(provider.logoPath)"
                        :alt="provider.name"
                        shape="square"
                        class="h-12 w-12 rounded-lg"
                      />
                    </component>
                  </AppTooltip>
                  <component
                    :is="watchLink ? 'a' : 'span'"
                    v-else
                    v-bind="outside(watchLink)"
                    class="flex h-12 items-center rounded-lg bg-surface-100 px-3 text-sm text-surface-800 no-underline hover:ring-2 hover:ring-primary-500/60 dark:bg-surface-700 dark:text-surface-100"
                  >
                    {{ provider.name }}
                  </component>
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
      </div>

      <section
        v-if="details.cast.length"
        class="mt-10"
        aria-labelledby="cast-title"
      >
        <h2 id="cast-title" class="text-xl font-semibold">
          {{ t('details.cast') }}
        </h2>
        <!-- A row that scrolls sideways, like the lists of the home page:
             the rest of the page is not pushed down. -->
        <AppScrollRow
          :previous-label="t('details.castPrevious')"
          :next-label="t('details.castNext')"
        >
          <li
            v-for="person in details.cast"
            :key="person.id"
            class="w-28 shrink-0 snap-start text-center sm:w-32"
          >
            <AppImage
              :src="person.profilePath ? profileUrl(person.profilePath) : null"
              icon="pi pi-user"
              class="w-full rounded-md"
            />
            <p class="mt-2 text-sm font-medium">{{ person.name }}</p>
            <p
              v-if="person.character"
              class="text-xs text-surface-500 dark:text-surface-400"
            >
              {{ person.character }}
            </p>
          </li>
        </AppScrollRow>
      </section>
    </article>
  </div>
</template>
