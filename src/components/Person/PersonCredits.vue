<script setup lang="ts">
  import { computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import type { MediaItem, PersonDetails } from '@shared/api';
  import CardGrid from '@/components/Cards/CardGrid.vue';
  import CardViewPicker from '@/components/Cards/CardViewPicker.vue';
  import AppSegmented from '@/components/ui/AppSegmented.vue';
  import { mediaType } from '@/util/media';

  const props = defineProps<{ person: PersonDetails }>();

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();

  type Role = 'cast' | 'crew';

  // The filters are in the address of the page, so they are still there
  // when the user comes back from a title.
  function fromQuery<T extends string>(name: string, values: readonly T[]) {
    const value = route.query[name];

    return values.includes(value as T) ? (value as T) : null;
  }

  function toQuery(name: string, value: string, fallback: string) {
    router.replace({
      query: { ...route.query, [name]: value === fallback ? undefined : value },
    });
  }

  // Behind the camera for someone known for it, such as a director; in
  // front of it for everyone else. Never a side with nothing.
  const usualRole = computed<Role>(() => {
    const { department, cast, crew } = props.person;

    return (department && department !== 'Acting' && crew.length) ||
      !cast.length
      ? 'crew'
      : 'cast';
  });

  const role = computed({
    get: (): Role => {
      const chosen = fromQuery('role', ['cast', 'crew'] as const);

      return chosen && props.person[chosen].length ? chosen : usualRole.value;
    },
    set: (value: string) => toQuery('role', value, usualRole.value),
  });

  const credits = computed(() => props.person[role.value]);

  // Movies or tv shows: only a choice when there are both.
  const bothKinds = computed(
    () =>
      credits.value.some((item) => mediaType(item) === 'movie') &&
      credits.value.some((item) => mediaType(item) === 'tv'),
  );

  const kind = computed({
    get: () =>
      (bothKinds.value && fromQuery('type', ['movie', 'tv'] as const)) || 'all',
    set: (value: string) => toQuery('type', value, 'all'),
  });

  const order = computed({
    get: () => fromQuery('order', ['recent'] as const) ?? 'known',
    set: (value: string) => toQuery('order', value, 'known'),
  });

  // Announced titles have no date yet: they are the most recent.
  const dateOf = (item: MediaItem) =>
    item.release_date || item.first_air_date || '9999';

  const items = computed(() => {
    const shown =
      kind.value === 'all'
        ? credits.value
        : credits.value.filter((item) => mediaType(item) === kind.value);

    return order.value === 'recent'
      ? [...shown].sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
      : shown;
  });

  const roleOptions = computed(() =>
    props.person.cast.length && props.person.crew.length
      ? [
          {
            value: 'cast',
            label: t('person.inCast', { count: props.person.cast.length }),
          },
          {
            value: 'crew',
            label: t('person.inCrew', { count: props.person.crew.length }),
          },
        ]
      : null,
  );

  const kindOptions = computed(() => [
    { value: 'all', label: t('search.all') },
    { value: 'movie', label: t('lists.movies') },
    { value: 'tv', label: t('lists.tvShows') },
  ]);

  const orderOptions = computed(() => [
    { value: 'known', label: t('person.bestKnown') },
    { value: 'recent', label: t('person.mostRecent') },
  ]);
</script>

<template>
  <section class="mt-10" aria-labelledby="credits-title">
    <div class="page">
      <h2 id="credits-title" class="text-xl font-semibold">
        {{ t('person.credits') }}
      </h2>
      <p
        v-if="!person.cast.length && !person.crew.length"
        class="mt-2 text-surface-500 dark:text-surface-400"
      >
        {{ t('person.noCredits') }}
      </p>
      <div v-else class="mt-3 flex flex-wrap items-center gap-3">
        <AppSegmented
          v-if="roleOptions"
          v-model="role"
          :options="roleOptions"
          :label="t('person.role')"
          name="person-role"
        />
        <AppSegmented
          v-if="bothKinds"
          v-model="kind"
          :options="kindOptions"
          :label="t('lists.kind')"
          name="person-kind"
        />
        <AppSegmented
          v-model="order"
          :options="orderOptions"
          :label="t('person.order')"
          name="person-order"
        />
        <CardViewPicker name="person-view" class="sm:ml-auto" />
      </div>
    </div>

    <CardGrid
      v-if="items.length"
      :items="items"
      :show-type="bothKinds && kind === 'all'"
    />
  </section>
</template>
