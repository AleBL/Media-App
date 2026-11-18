<script setup lang="ts">
  import AppButton from './AppButton.vue';

  // A button that is on or off, such as "in my list": the label stays the
  // same, aria-pressed and the look say which. A click listener, `disabled`
  // and the rest go to the button.
  defineOptions({ inheritAttrs: false });

  withDefaults(
    defineProps<{
      label: string;
      /** A PrimeIcons class, shown while off. */
      icon: string;
      /** The one shown while on, such as the filled version of the icon. */
      pressedIcon?: string;
      /** Not known yet: neither on nor off. */
      pressed?: boolean;
      /** Saving the change: a spinner, and no second click meanwhile. */
      loading?: boolean;
      size?: 'sm' | 'md';
    }>(),
    {
      pressedIcon: undefined,
      pressed: undefined,
      loading: false,
      size: 'md',
    },
  );
</script>

<template>
  <AppButton
    v-bind="$attrs"
    :label="label"
    :icon="pressed ? (pressedIcon ?? icon) : icon"
    :severity="pressed ? 'primary' : 'secondary'"
    :size="size"
    :loading="loading"
    :aria-pressed="pressed === undefined ? undefined : pressed"
  />
</template>
