<script setup lang="ts">
  import { computed } from 'vue';
  import {
    DISCOVER_SORTS,
    MIN_VOTES,
    type DiscoverFilters,
    type DiscoverSort,
  } from '@shared/api';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppChip from '@/components/ui/AppChip.vue';
  import AppCombobox from '@/components/ui/AppCombobox.vue';
  import AppSegmented from '@/components/ui/AppSegmented.vue';
  import AppSkeleton from '@/components/ui/AppSkeleton.vue';
  import { classIndColors, meaningOf } from '@/util/ageRating';
  import { countryName } from '@/util/region';
  import MyServices from './MyServices.vue';
  import {
    FIRST_YEAR,
    LAST_YEAR,
    MIN_RATINGS,
    type DiscoverChoice,
  } from './query';

  // The filters of the Explore page: beside the titles on a wide screen,
  // in a drawer on a narrow one. Each change goes to the page at once.
  const props = defineProps<{
    choice: DiscoverChoice;
    /** What the filters offer, once TMDB sent it. */
    filters: DiscoverFilters | null;
    /** What the filters offer could not be loaded. */
    failed: boolean;
    /** The country of the settings, of the services and the age ratings. */
    region: string;
    /** How many filters are in use. */
    count: number;
    /** Tells apart the ids of each copy of the filters on the page. */
    idPrefix: string;
    /** Shows the title and "Clear" (the drawer has its own). */
    heading?: boolean;
    /** Has the order too, which a wide screen has beside the titles. */
    sorting?: boolean;
  }>();

  const emit = defineEmits<{
    change: [Partial<DiscoverChoice>];
    clear: [];
    retry: [];
  }>();

  const { t, locale } = useI18n();

  const id = (name: string) => `${props.idPrefix}-${name}`;

  function pickGenre(genre: number, picked: boolean) {
    const genres = props.choice.genres.filter((one) => one !== genre);

    emit('change', { genres: picked ? [...genres, genre] : genres });
  }

  // A year typed in, once the field is left: one out of range goes back
  // to what it was, and two the wrong way round change places.
  function setYear(field: 'fromYear' | 'toYear', event: Event) {
    const input = event.target as HTMLInputElement;
    const text = input.value.trim();
    const year = Number(text);

    if (
      text &&
      (!Number.isInteger(year) || year < FIRST_YEAR || year > LAST_YEAR)
    ) {
      input.value = String(props.choice[field] ?? '');
      return;
    }

    const years = { ...props.choice, [field]: text ? year : undefined };
    const { fromYear, toYear } = years;

    emit(
      'change',
      fromYear && toYear && fromYear > toYear
        ? { fromYear: toYear, toYear: fromYear }
        : { fromYear, toYear },
    );
  }

  const DECADES = [2020, 2010, 2000, 1990, 1980, 1970];

  const isDecade = (decade: number) =>
    props.choice.fromYear === decade && props.choice.toYear === decade + 9;

  function pickDecade(decade: number) {
    emit(
      'change',
      isDecade(decade)
        ? { fromYear: undefined, toYear: undefined }
        : { fromYear: decade, toYear: decade + 9 },
    );
  }

  const ratingOptions = computed(() => [
    { value: '', label: t('discover.any') },
    ...MIN_RATINGS.map((rating) => ({
      value: String(rating),
      label: t('discover.atLeast', { n: rating }),
    })),
  ]);

  const rating = computed({
    get: () => String(props.choice.minRating ?? ''),
    set: (value: string) =>
      emit('change', { minRating: value ? Number(value) : undefined }),
  });

  // One the country does not have (a link from another) is none.
  const age = computed({
    get: () =>
      props.choice.ageRating &&
      props.filters?.ageRatings.includes(props.choice.ageRating)
        ? props.choice.ageRating
        : '',
    set: (value: string) => emit('change', { ageRating: value || undefined }),
  });

  // Each rating as a badge, in the colors of the ClassInd in Brazil: the
  // one chosen and the milder ones filled in, the stricter ones not. Said
  // with its meaning where the app knows it.
  const ageOptions = computed(() => {
    const codes = props.filters?.ageRatings ?? [];
    const chosen = codes.indexOf(age.value);

    return codes.map((code, index) => {
      const rating = { country: props.region, code };
      const meaning = meaningOf(rating);

      return {
        code,
        colors: classIndColors(rating),
        allowed: chosen === -1 || index <= chosen,
        name: meaning
          ? `${code}: ${t(meaning.key, { age: meaning.age })}`
          : code,
      };
    });
  });

  const sortOptions = computed(() =>
    DISCOVER_SORTS.map((sort) => ({
      value: sort,
      label: t(`discover.${sort}`),
    })),
  );

  const sort = computed({
    get: () => props.choice.sort,
    set: (value: string) => emit('change', { sort: value as DiscoverSort }),
  });

  // Each language by its name in the language of the app, in that order.
  const languageOptions = computed(() => {
    let names: Intl.DisplayNames | null = null;

    try {
      names = new Intl.DisplayNames([locale.value], { type: 'language' });
    } catch {
      // Without names, the codes.
    }

    const options = (props.filters?.languages ?? []).map((code) => {
      const name = names?.of(code) ?? code;

      return {
        value: code,
        label: name.charAt(0).toLocaleUpperCase(locale.value) + name.slice(1),
      };
    });

    return [
      { value: '', label: t('discover.anyLanguage') },
      ...options.sort((a, b) => a.label.localeCompare(b.label, locale.value)),
    ];
  });

  const language = computed({
    get: () => props.choice.originalLanguage ?? '',
    set: (value: string) =>
      emit('change', { originalLanguage: value || undefined }),
  });

  const mine = computed({
    get: () => props.choice.mine,
    set: (value: boolean) => emit('change', { mine: value }),
  });

  const title = 'text-sm font-semibold';
  // A native radio button over the whole badge, unseen.
  const AGE_INPUT =
    'peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-md opacity-0';
  const AGE_BADGE =
    'pointer-events-none inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs leading-none transition peer-checked:ring-2 peer-checked:ring-primary-600 peer-checked:ring-offset-2 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 dark:peer-checked:ring-primary-400 dark:peer-focus-visible:ring-primary-400 dark:ring-offset-surface-900';
  const hint = 'mt-1 text-xs text-surface-500 dark:text-surface-400';
</script>

<template>
  <div class="flex flex-col gap-6">
    <div v-if="heading" class="flex min-h-9 items-center justify-between gap-2">
      <h2 :id="id('title')" class="text-lg font-semibold">
        {{
          count
            ? t('discover.filtersCount', { n: count })
            : t('discover.filters')
        }}
      </h2>
      <AppButton
        v-if="count"
        severity="ghost"
        size="sm"
        icon="pi pi-filter-slash"
        :label="t('discover.clear')"
        @click="emit('clear')"
      />
    </div>

    <div v-if="failed" role="alert" class="text-sm">
      <p class="text-red-700 dark:text-red-400">
        {{ t('discover.filtersFailed') }}
      </p>
      <AppButton
        severity="secondary"
        size="sm"
        icon="pi pi-refresh"
        :label="t('discover.tryAgain')"
        class="mt-2"
        @click="emit('retry')"
      />
    </div>

    <!-- The shape of the filters until they come. -->
    <div v-else-if="!filters" class="flex flex-col gap-3" aria-hidden="true">
      <AppSkeleton class="h-4 w-1/3" />
      <div class="flex flex-wrap gap-2">
        <AppSkeleton v-for="index in 8" :key="index" class="h-8 w-20" />
      </div>
      <AppSkeleton class="mt-4 h-4 w-1/4" />
      <AppSkeleton class="h-9 w-full" />
    </div>

    <template v-else>
      <section v-if="sorting" :aria-labelledby="id('sort')">
        <h3 :id="id('sort')" :class="title">{{ t('discover.order') }}</h3>
        <AppSegmented
          v-model="sort"
          :options="sortOptions"
          :label="t('discover.order')"
          :name="id('sort-choice')"
          class="mt-2"
        />
      </section>

      <section v-if="filters.genres.length" :aria-labelledby="id('genres')">
        <h3 :id="id('genres')" :class="title">{{ t('discover.genres') }}</h3>
        <div
          role="group"
          :aria-labelledby="id('genres')"
          class="mt-2 flex flex-wrap gap-2"
        >
          <AppChip
            v-for="genre in filters.genres"
            :key="genre.id"
            :model-value="choice.genres.includes(genre.id)"
            :label="genre.name"
            @update:model-value="pickGenre(genre.id, $event)"
          />
        </div>
        <p v-if="choice.genres.length > 1" :class="hint">
          {{ t('discover.allGenres') }}
        </p>
      </section>

      <section :aria-labelledby="id('years')">
        <h3 :id="id('years')" :class="title">{{ t('discover.years') }}</h3>
        <div class="mt-2 flex items-center gap-2 text-sm">
          <label :for="id('from')">{{ t('discover.from') }}</label>
          <input
            :id="id('from')"
            type="number"
            inputmode="numeric"
            :min="FIRST_YEAR"
            :max="LAST_YEAR"
            :value="choice.fromYear ?? ''"
            placeholder="1900"
            class="field w-24"
            @change="setYear('fromYear', $event)"
          />
          <label :for="id('to')">{{ t('discover.to') }}</label>
          <input
            :id="id('to')"
            type="number"
            inputmode="numeric"
            :min="FIRST_YEAR"
            :max="LAST_YEAR"
            :value="choice.toYear ?? ''"
            :placeholder="String(new Date().getFullYear())"
            class="field w-24"
            @change="setYear('toYear', $event)"
          />
        </div>
        <div
          role="group"
          :aria-label="t('discover.decades')"
          class="mt-2 flex flex-wrap gap-1.5"
        >
          <button
            v-for="decade in DECADES"
            :key="decade"
            type="button"
            :aria-pressed="isDecade(decade)"
            class="rounded-md px-2 py-1 text-xs font-medium text-surface-600 transition-colors hover:bg-surface-100 hover:text-surface-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 aria-pressed:bg-primary-700 aria-pressed:text-white dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-surface-0 dark:focus-visible:ring-primary-400 dark:aria-pressed:bg-primary-400 dark:aria-pressed:text-surface-950"
            @click="pickDecade(decade)"
          >
            {{ t('discover.decade', { decade }) }}
          </button>
        </div>
      </section>

      <section :aria-labelledby="id('rating')">
        <h3 :id="id('rating')" :class="title">
          {{ t('discover.minRating') }}
        </h3>
        <AppSegmented
          v-model="rating"
          :options="ratingOptions"
          :label="t('discover.minRating')"
          :name="id('rating-choice')"
          class="mt-2"
        />
        <p v-if="choice.minRating" :class="hint">
          {{ t('discover.votesHint', { n: MIN_VOTES[choice.type] }) }}
        </p>
      </section>

      <section v-if="filters.ageRatings.length" :aria-labelledby="id('age')">
        <h3 :id="id('age')" :class="title">{{ t('discover.ageRating') }}</h3>
        <div
          role="radiogroup"
          :aria-labelledby="id('age')"
          class="mt-2 flex flex-wrap items-center gap-1"
        >
          <label class="relative">
            <input
              v-model="age"
              type="radio"
              :name="id('age-choice')"
              value=""
              :class="AGE_INPUT"
            />
            <span
              :class="[
                AGE_BADGE,
                'border-surface-300 px-2.5 font-medium text-surface-700 dark:border-surface-600 dark:text-surface-200',
              ]"
            >
              {{ t('discover.allAges') }}
            </span>
          </label>
          <label
            v-for="option in ageOptions"
            :key="option.code"
            class="relative"
          >
            <input
              v-model="age"
              type="radio"
              :name="id('age-choice')"
              :value="option.code"
              :aria-label="option.name"
              :class="AGE_INPUT"
            />
            <span
              :class="[
                AGE_BADGE,
                'font-bold',
                !option.allowed
                  ? 'border-surface-300 text-surface-600 dark:border-surface-600 dark:text-surface-300'
                  : option.colors
                    ? [option.colors, 'border-black/10 dark:border-white/25']
                    : 'border-surface-300 bg-surface-200 text-surface-900 dark:border-surface-600 dark:bg-surface-700 dark:text-surface-0',
              ]"
            >
              {{ option.code }}
            </span>
          </label>
        </div>
        <p :class="hint">
          {{ t('discover.ageHint', { country: countryName(region, locale) }) }}
        </p>
      </section>

      <section v-if="filters.languages.length">
        <label :for="id('language')" :class="['block', title]">
          {{ t('discover.originalLanguage') }}
        </label>
        <div class="mt-2">
          <AppCombobox
            :id="id('language')"
            v-model="language"
            :options="languageOptions"
            :empty="t('discover.noLanguage')"
            :open-label="t('discover.allLanguages')"
            block
          />
        </div>
      </section>

      <MyServices
        v-if="filters.providers.length"
        v-model:on="mine"
        :providers="filters.providers"
        :id-prefix="idPrefix"
      />
    </template>
  </div>
</template>
