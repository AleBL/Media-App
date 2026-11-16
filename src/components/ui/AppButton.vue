<script setup lang="ts">
  // A button of the app. Anything else, such as `disabled`, `aria-label` or
  // a click listener, goes to the <button> itself.
  withDefaults(
    defineProps<{
      label?: string;
      /** A PrimeIcons class, such as `pi pi-save`. */
      icon?: string;
      severity?: 'primary' | 'secondary' | 'danger';
    }>(),
    { label: undefined, icon: undefined, severity: 'primary' },
  );

  const SEVERITY = {
    primary:
      'bg-primary-500 ring-primary-500 hover:bg-primary-600 hover:ring-primary-600 focus-visible:ring-primary-500 dark:bg-primary-400 dark:ring-primary-400 dark:hover:bg-primary-300 dark:hover:ring-primary-300',
    secondary:
      'bg-surface-500 ring-surface-500 hover:bg-surface-600 hover:ring-surface-600 focus-visible:ring-surface-500 dark:bg-surface-400 dark:ring-surface-400 dark:hover:bg-surface-300 dark:hover:ring-surface-300',
    danger:
      'bg-red-500 ring-red-500 hover:bg-red-600 hover:ring-red-600 focus-visible:ring-red-500 dark:bg-red-400 dark:ring-red-400 dark:hover:bg-red-300 dark:hover:ring-red-300',
  };
</script>

<template>
  <button
    type="button"
    :class="[
      'relative inline-flex items-center justify-center gap-2 rounded-md text-center align-bottom text-sm text-white shadow-sm ring-1 transition duration-200 dark:text-surface-900',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:cursor-default disabled:opacity-60',
      label ? 'min-w-[2rem] px-2.5 py-1.5' : 'h-8 w-8 p-0',
      SEVERITY[severity],
    ]"
  >
    <span v-if="icon" :class="icon" aria-hidden="true" />
    <span v-if="label" class="font-semibold">{{ label }}</span>
  </button>
</template>
