<script setup lang="ts">
  // One of many to pick, such as a genre: a native checkbox under the whole
  // chip, so the keyboard, a screen reader and a click anywhere on it work
  // as with any checkbox.
  defineProps<{
    label: string;
    /** A small picture before the label, such as the logo of a service. */
    image?: string;
  }>();

  const checked = defineModel<boolean>({ required: true });
</script>

<template>
  <label class="relative inline-flex">
    <input
      v-model="checked"
      type="checkbox"
      class="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-full opacity-0"
    />
    <span
      class="pointer-events-none inline-flex items-center gap-1.5 rounded-full border border-surface-300 bg-surface-0 px-3 py-1.5 text-sm font-medium text-surface-700 transition-colors peer-hover:border-surface-400 peer-hover:text-surface-900 peer-checked:border-primary-700 peer-checked:bg-primary-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-200 dark:peer-hover:border-surface-500 dark:peer-hover:text-surface-0 dark:peer-checked:border-primary-400 dark:peer-checked:bg-primary-400 dark:peer-checked:text-surface-950 dark:peer-focus-visible:ring-primary-400 dark:peer-focus-visible:ring-offset-surface-900"
    >
      <span v-if="checked" class="pi pi-check text-xs" aria-hidden="true" />
      <img
        v-if="image"
        :src="image"
        alt=""
        class="-ml-1 h-5 w-5 rounded-sm"
        loading="lazy"
      />
      {{ label }}
    </span>
  </label>
</template>
