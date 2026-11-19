<script setup lang="ts">
  import { computed } from 'vue';
  import type { Certification } from '@shared/api';
  import AppTooltip from '@/components/ui/AppTooltip.vue';
  import { classIndColors, meaningOf } from '@/util/ageRating';
  import { countryName } from '@/util/region';

  const props = defineProps<{
    certification: Certification;
    /** The country of the settings, whose rating needs no name. */
    region: string;
  }>();

  const { t, locale } = useI18n();

  // The rating of the United States, when the region has none.
  const foreign = computed(() => props.certification.country !== props.region);

  const colors = computed(() => classIndColors(props.certification));

  // "Age rating (United States): PG-13. May be inappropriate for children
  // under 13", the same on hover and for screen readers.
  const description = computed(() => {
    const { country, code } = props.certification;
    const name = foreign.value
      ? t('details.ageRatingIn', {
          country: countryName(country, locale.value),
          code,
        })
      : t('details.ageRating', { code });
    const meaning = meaningOf(props.certification);

    return meaning ? `${name}. ${t(meaning.key, { age: meaning.age })}` : name;
  });
</script>

<template>
  <!-- A badge with the code, in the colors of the ClassInd in Brazil and
       plain elsewhere. It can take the focus, for the keyboard to reach
       its meaning too. -->
  <AppTooltip :text="description">
    <span
      role="img"
      tabindex="0"
      :aria-label="description"
      :class="[
        'inline-flex h-6 min-w-6 cursor-default items-center justify-center gap-1 rounded-sm border px-1.5 text-xs font-bold leading-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-surface-800',
        colors
          ? [colors, 'border-black/10 dark:border-white/25']
          : 'border-surface-400 text-surface-700 dark:border-surface-500 dark:text-surface-200',
      ]"
    >
      <span v-if="foreign" class="font-medium opacity-75">{{
        certification.country
      }}</span>
      {{ certification.code }}
    </span>
  </AppTooltip>
</template>
