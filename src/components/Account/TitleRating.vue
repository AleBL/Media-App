<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import type { MediaType } from '@shared/api';
  import AppTooltip from '@/components/ui/AppTooltip.vue';
  import { useAccountStore } from '@/stores/account';

  const props = defineProps<{ type: MediaType; id: number }>();

  const { t, locale } = useI18n();
  const account = useAccountStore();

  const title = computed(() => ({ type: props.type, id: props.id }));
  // What TMDB said when the page of the title asked (AccountButtons).
  const rating = computed(() => account.ratingOf(title.value));
  const failed = ref(false);
  const name = computed(() => `rating-${props.type}-${props.id}`);

  const number = computed(
    () =>
      new Intl.NumberFormat(locale.value, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
  );

  // A choice shows at once and is saved; the store undoes it if TMDB does
  // not take it.
  const choice = computed(() => rating.value ?? null);

  // The stars follow the pointer before a click, then the rating.
  const hovered = ref<number | null>(null);
  const shown = computed(() => hovered.value ?? choice.value ?? 0);

  function starIcon(star: number) {
    if (star <= shown.value) {
      return 'pi-star-fill';
    }

    return star - 0.5 === shown.value ? 'pi-star-half-fill' : 'pi-star';
  }

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
  <!-- Ten stars, each in two halves: the 20 ratings TMDB takes, from 0.5
       to 10. Each half is a radio button, so the arrows of the keyboard
       move along them and a screen reader reads the number. It waits for
       TMDB to say what the rating is. -->
  <div>
    <div class="flex flex-wrap items-center gap-3">
      <span :id="`${name}-label`" class="text-sm font-medium">
        {{ t('lists.yourRating') }}
      </span>
      <div
        role="radiogroup"
        :aria-labelledby="`${name}-label`"
        class="flex items-center"
        @mouseleave="hovered = null"
      >
        <span
          v-for="star in 10"
          :key="star"
          class="relative h-7 w-7 rounded-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500"
        >
          <span
            :class="[
              'pi pointer-events-none absolute inset-0 flex items-center justify-center text-lg',
              starIcon(star),
              shown >= star - 0.5
                ? 'text-yellow-500'
                : 'text-surface-300 dark:text-surface-600',
            ]"
            aria-hidden="true"
          />
          <label
            v-for="value in [star - 0.5, star]"
            :key="value"
            :class="[
              'absolute inset-y-0 w-1/2',
              value % 1 ? 'left-0' : 'right-0',
              rating === undefined ? 'cursor-default' : 'cursor-pointer',
            ]"
            @mouseenter="rating !== undefined && (hovered = value)"
          >
            <input
              type="radio"
              class="sr-only"
              :name="name"
              :value="value"
              :checked="choice === value"
              :disabled="rating === undefined"
              @change="choose(value)"
            />
            <span class="sr-only">{{ number.format(value) }}</span>
          </label>
        </span>
      </div>
      <!-- The rating and the way to take it away, together, beside the
           stars. The radio buttons already read the number. -->
      <span
        v-if="choice !== null"
        class="inline-flex h-8 items-center gap-0.5 rounded-full bg-yellow-100 pl-3 pr-0.5 text-sm font-semibold tabular-nums text-yellow-900 dark:bg-yellow-400/15 dark:text-yellow-200"
      >
        <span aria-hidden="true">{{ number.format(choice) }}</span>
        <AppTooltip :text="t('lists.removeRating')" side="top">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-yellow-200 dark:hover:bg-yellow-400/25"
            :aria-label="t('lists.removeRating')"
            @click="choose(null)"
          >
            <span class="pi pi-times text-xs" aria-hidden="true" />
          </button>
        </AppTooltip>
      </span>
      <span
        v-else
        class="text-sm text-surface-600 dark:text-surface-300"
        aria-hidden="true"
      >
        {{ t('lists.notRated') }}
      </span>
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
