<script setup lang="ts">
  import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { storeToRefs } from 'pinia';
  import { useResizeObserver } from '@vueuse/core';
  import ImdbLink from '@/components/Details/ImdbLink.vue';
  import PersonCredits from '@/components/Person/PersonCredits.vue';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppImage from '@/components/ui/AppImage.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import AppSkeleton from '@/components/ui/AppSkeleton.vue';
  import AppState from '@/components/ui/AppState.vue';
  import AppTooltip from '@/components/ui/AppTooltip.vue';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';
  import { usePersonStore } from '@/stores/person';
  import { today } from '@/stores/watched';
  import { accessProblem } from '@/util/access';
  import { profileUrl } from '@/util/images';
  import { ageOn, departmentName, personLinks } from '@/util/people';

  const props = defineProps<{ id: number }>();

  const { t, locale } = useI18n();
  const router = useRouter();
  const store = usePersonStore();
  const credentials = useCredentialsStore();
  const { person, loading, error } = storeToRefs(store);
  const desktop = isDesktop();

  // Asked again in the new language when it changes: TMDB translates the
  // biography and the titles of the credits.
  watch([() => props.id, locale], () => store.load(props.id), {
    immediate: true,
  });

  const problem = computed(() =>
    accessProblem(error.value?.code, desktop, credentials.hasKey),
  );

  const errorMessage = computed(() => {
    if (error.value?.code === 'not-found') {
      return 'person.notFound';
    }

    if (!problem.value) {
      return 'person.error';
    }

    return problem.value === 'webUnavailable'
      ? 'details.errorWebUnavailable'
      : `access.${problem.value}`;
  });

  const canRetry = computed(
    () => !problem.value && error.value?.code !== 'not-found',
  );

  // Back to where the user came from, usually the page of a title. A page
  // opened by its address has nowhere to go back to.
  function back() {
    if (router.options.history.state.back) {
      router.back();
    } else {
      router.push({ name: 'search' });
    }
  }

  // A day as TMDB sends it (YYYY-MM-DD), written the way of the language,
  // read as UTC on both ends so no timezone moves it to another day.
  function longDate(day: string) {
    const [year, month, date] = day.split('-').map(Number);

    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(Date.UTC(year, month - 1, date));
  }

  // "September 2, 1964 (62 years old)", or the age they died at.
  const facts = computed(() => {
    const value = person.value;

    if (!value) {
      return [];
    }

    const { birthday, deathday } = value;
    const age = birthday ? ageOn(birthday, deathday ?? today()) : null;
    let born = birthday && longDate(birthday);
    let died = deathday && longDate(deathday);

    if (age !== null && deathday) {
      died = t('person.diedAge', { date: died, n: age }, age);
    } else if (age !== null) {
      born = t('person.bornAge', { date: born, n: age }, age);
    }

    return [
      {
        key: 'knownFor',
        value: value.department && departmentName(value.department, t),
      },
      { key: 'born', value: born },
      { key: 'died', value: died },
      { key: 'placeOfBirth', value: value.placeOfBirth },
    ].filter((fact): fact is { key: string; value: string } => !!fact.value);
  });

  const imdbUrl = computed(() =>
    person.value?.links.imdb
      ? `https://www.imdb.com/name/${person.value.links.imdb}/`
      : null,
  );

  const socials = computed(() =>
    person.value ? personLinks(person.value.links) : [],
  );

  // The biography shows its start, and all of it when asked. The button
  // only appears when there is more than the start.
  const biography = useTemplateRef<HTMLElement>('biography');
  const expanded = ref(false);
  const longer = ref(false);

  function measure() {
    const element = biography.value;

    if (element && !expanded.value) {
      longer.value = element.scrollHeight > element.clientHeight + 1;
    }
  }

  useResizeObserver(biography, measure);
  watch(
    () => person.value?.biography,
    async () => {
      expanded.value = false;
      await nextTick();
      measure();
    },
  );
</script>

<template>
  <div class="pb-10">
    <div class="page my-4">
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
          @click="store.load(id)"
        />
      </template>
    </AppState>

    <!-- The shape of the page until it comes; the text is for screen
         readers. -->
    <div
      v-else-if="!person"
      role="status"
      class="page flex flex-col gap-6 sm:flex-row"
    >
      <span class="sr-only">{{ t('details.loading') }}</span>
      <AppSkeleton
        class="aspect-[2/3] w-48 self-center sm:w-64 sm:self-start"
      />
      <div class="flex-1">
        <AppSkeleton class="h-9 w-1/2" />
        <AppSkeleton class="mt-4 h-4 w-1/3" />
        <AppSkeleton class="mt-3 h-4 w-2/5" />
        <AppSkeleton class="mt-6 h-4 w-full" />
        <AppSkeleton class="mt-3 h-4 w-full" />
        <AppSkeleton class="mt-3 h-4 w-5/6" />
      </div>
    </div>

    <article v-else :aria-busy="loading" aria-labelledby="person-name">
      <div class="page">
        <!-- In another language, on its way: the page stays readable. -->
        <AppLoadingBar v-if="loading" class="mb-3" />

        <div
          class="grid gap-6 sm:grid-cols-[16rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)]"
        >
          <AppImage
            :src="
              person.profilePath ? profileUrl(person.profilePath, 'h632') : null
            "
            icon="pi pi-user"
            eager
            class="w-48 self-start justify-self-center rounded-md shadow-lg ring-1 ring-black/5 sm:w-full"
          />

          <div class="min-w-0">
            <h1 id="person-name" class="text-3xl font-semibold">
              {{ person.name }}
            </h1>

            <dl
              v-if="facts.length"
              class="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm"
            >
              <template v-for="fact in facts" :key="fact.key">
                <dt class="text-surface-500 dark:text-surface-400">
                  {{ t(`person.${fact.key}`) }}
                </dt>
                <dd class="m-0">{{ fact.value }}</dd>
              </template>
            </dl>

            <section
              v-if="person.biography"
              class="mt-6"
              aria-labelledby="biography-title"
            >
              <h2 id="biography-title" class="text-lg font-semibold">
                {{ t('person.biography') }}
              </h2>
              <p
                v-if="person.biographyLanguage"
                class="mt-1 text-sm text-surface-500 dark:text-surface-400"
              >
                {{ t('person.biographyInEnglish') }}
              </p>
              <div
                id="person-biography"
                ref="biography"
                :lang="person.biographyLanguage"
                :class="[
                  'mt-2 max-w-[80ch] whitespace-pre-line leading-relaxed',
                  !expanded && 'line-clamp-6',
                ]"
              >
                {{ person.biography }}
              </div>
              <AppButton
                v-if="longer"
                :label="t(expanded ? 'person.readLess' : 'person.readMore')"
                :icon="expanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                severity="ghost"
                class="-ml-3 mt-1"
                aria-controls="person-biography"
                :aria-expanded="expanded"
                @click="expanded = !expanded"
              />
            </section>

            <div
              v-if="imdbUrl || person.links.homepage || socials.length"
              class="mt-6 flex flex-wrap items-center gap-3"
            >
              <ImdbLink v-if="imdbUrl" :href="imdbUrl" />
              <a
                v-if="person.links.homepage"
                :href="person.links.homepage"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-9 items-center gap-2 rounded-md border border-surface-300 px-3.5 text-sm font-semibold text-surface-800 no-underline transition hover:bg-surface-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-600 dark:text-surface-100 dark:hover:bg-surface-700 dark:focus-visible:ring-primary-400"
              >
                <span class="pi pi-globe" aria-hidden="true" />
                {{ t('person.homepage') }}
              </a>
              <ul
                v-if="socials.length"
                class="m-0 flex list-none gap-1 p-0"
                :aria-label="t('person.socials')"
              >
                <li v-for="link in socials" :key="link.key">
                  <AppTooltip :text="link.label">
                    <a
                      :href="link.href"
                      target="_blank"
                      rel="noopener noreferrer"
                      :aria-label="link.label"
                      class="flex h-9 w-9 items-center justify-center rounded-full text-surface-600 no-underline transition hover:bg-surface-100 hover:text-surface-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-0 dark:focus-visible:ring-primary-400"
                    >
                      <span
                        :class="[link.icon, 'text-lg']"
                        aria-hidden="true"
                      />
                    </a>
                  </AppTooltip>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <PersonCredits :person="person" />
    </article>
  </div>
</template>
