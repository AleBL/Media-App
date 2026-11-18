<script setup lang="ts">
  import { RouterLink, type RouteLocationRaw } from 'vue-router';
  import AppSpinner from './AppSpinner.vue';

  // A button of the app. Anything else, such as `disabled`, `aria-label` or
  // a click listener, goes to the <button> (or <a>) itself; bound by hand so
  // that `loading` disables it even when `disabled` says otherwise.
  defineOptions({ inheritAttrs: false });

  const props = withDefaults(
    defineProps<{
      label?: string;
      /** A PrimeIcons class, such as `pi pi-save`. */
      icon?: string;
      /**
       * `primary` for the main action of a page, `secondary` (an outline)
       * for the others, `ghost` (only the text) for the quiet ones, such as
       * going back, and `danger` for what cannot be undone.
       */
      severity?: 'primary' | 'secondary' | 'ghost' | 'danger';
      size?: 'sm' | 'md';
      /** Waiting for an answer: a spinner in place of the icon, disabled. */
      loading?: boolean;
      /**
       * Makes it a link to a page of another site, which opens in the
       * browser of the system (a new tab on the web).
       */
      href?: string;
      /** Makes it a link to a page of the app (aria-current when there). */
      to?: RouteLocationRaw;
    }>(),
    {
      label: undefined,
      icon: undefined,
      severity: 'primary',
      size: 'md',
      loading: false,
      href: undefined,
      to: undefined,
    },
  );

  // White on primary-700 and dark text on primary-400 keep the contrast of
  // WCAG AA (4.5:1) for the small bold text of a button.
  const SEVERITY = {
    primary:
      'bg-primary-700 text-white shadow-xs hover:bg-primary-800 dark:bg-primary-400 dark:text-surface-900 dark:hover:bg-primary-300',
    secondary:
      'bg-transparent text-surface-700 ring-1 ring-inset ring-surface-300 hover:bg-surface-100 dark:text-surface-100 dark:ring-surface-600 dark:hover:bg-surface-700',
    ghost:
      'bg-transparent text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-700',
    danger:
      'bg-red-700 text-white shadow-xs hover:bg-red-800 dark:bg-red-400 dark:text-surface-900 dark:hover:bg-red-300',
  };

  const SIZE = {
    sm: { text: 'h-8 px-2.5', icon: 'h-8 w-8' },
    md: { text: 'h-9 px-3.5', icon: 'h-9 w-9' },
  };

  function attributes() {
    if (props.to) {
      return { to: props.to };
    }

    if (props.href) {
      return { href: props.href, target: '_blank', rel: 'noopener noreferrer' };
    }

    return {
      type: 'button',
      ...(props.loading && { disabled: true, 'aria-busy': 'true' }),
    };
  }
</script>

<template>
  <component
    :is="to ? RouterLink : href ? 'a' : 'button'"
    v-bind="{ ...$attrs, ...attributes() }"
    :class="[
      'relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-center align-bottom text-sm font-semibold no-underline transition duration-200',
      'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-surface-800',
      'disabled:pointer-events-none disabled:cursor-default disabled:opacity-60',
      label || $slots.default ? SIZE[size].text : SIZE[size].icon,
      SEVERITY[severity],
    ]"
  >
    <AppSpinner v-if="loading" size="sm" />
    <span v-else-if="icon" :class="icon" aria-hidden="true" />
    <span v-if="label">{{ label }}</span>
    <!-- Anything else after them, such as a picture and an arrow. -->
    <slot />
  </component>
</template>
