<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { RATINGS, type MediaType } from '@shared/api';
  import { useAccountStore } from '@/stores/account';

  const props = defineProps<{ type: MediaType; id: number }>();

  const { t, locale } = useI18n();
  const account = useAccountStore();

  const title = computed(() => ({ type: props.type, id: props.id }));
  // What TMDB said when the page of the title asked (AccountButtons).
  const rating = computed(() => account.ratingOf(title.value));
  const failed = ref(false);

  const number = computed(
    () =>
      new Intl.NumberFormat(locale.value, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
  );

  // A choice shows at once and is saved; the store undoes it if TMDB does
  // not take it.
  const choice = computed({
    get: () => rating.value ?? null,
    set: (value: number | null) => void choose(value),
  });

  watch(title, () => {
    failed.value = false;
  });

  async function choose(value: number | null) {
    failed.value = false;

    const answer = await account.rate(title.value, value);

    if (answer && !answer.ok && answer.error.code !== 'signed-out') {
      failed.value = true;
    }
  }
</script>

<template>
  <!-- A native select: the keyboard, screen readers and phones already know
       it, and choosing "Not rated" takes the rating away. It waits for TMDB
       to say what the rating is. -->
  <div>
    <div class="flex flex-wrap items-center gap-3">
      <label :for="`rating-${type}-${id}`" class="text-sm font-medium">
        {{ t('lists.yourRating') }}
      </label>
      <select
        :id="`rating-${type}-${id}`"
        v-model="choice"
        :disabled="rating === undefined"
        class="rounded-md border border-surface-300 bg-surface-0 px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60 dark:border-surface-600 dark:bg-surface-900 dark:[color-scheme:dark] dark:focus-visible:ring-primary-400"
      >
        <option :value="null">{{ t('lists.notRated') }}</option>
        <option v-for="value in RATINGS" :key="value" :value="value">
          {{ number.format(value) }}
        </option>
      </select>
      <i
        v-if="rating"
        class="pi pi-star-fill text-yellow-500"
        aria-hidden="true"
      />
    </div>
    <p
      v-if="failed"
      role="alert"
      class="mt-2 text-sm text-red-600 dark:text-red-400"
    >
      {{ t('lists.rateFailed') }}
    </p>
  </div>
</template>
