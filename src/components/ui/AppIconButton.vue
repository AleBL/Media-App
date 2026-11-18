<script setup lang="ts">
  import type { RouteLocationRaw } from 'vue-router';
  import AppButton from './AppButton.vue';
  import AppTooltip from './AppTooltip.vue';

  // A button of only an icon: its label names it (aria-label) and shows as
  // a hint on hover and focus. A click listener and the rest go to the
  // button.
  defineOptions({ inheritAttrs: false });

  withDefaults(
    defineProps<{
      /** A PrimeIcons class. */
      icon: string;
      label: string;
      severity?: 'primary' | 'secondary' | 'ghost' | 'danger';
      size?: 'sm' | 'md';
      loading?: boolean;
      href?: string;
      to?: RouteLocationRaw;
      side?: 'top' | 'right' | 'bottom' | 'left';
    }>(),
    {
      severity: 'ghost',
      size: 'md',
      loading: false,
      href: undefined,
      to: undefined,
      side: 'bottom',
    },
  );
</script>

<template>
  <AppTooltip :text="label" :side="side">
    <AppButton
      v-bind="$attrs"
      :icon="icon"
      :aria-label="label"
      :severity="severity"
      :size="size"
      :loading="loading"
      :href="href"
      :to="to"
    />
  </AppTooltip>
</template>
