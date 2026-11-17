<script setup lang="ts">
  // One choice among a few, side by side, such as the theme or the type of
  // a search. Native radio buttons underneath: the arrows of the keyboard
  // move along them, and each is named by its text.
  defineProps<{
    options: {
      value: string;
      label: string;
      /** A PrimeIcons class. */
      icon?: string;
      /** The language of the label, when it is not the one of the app. */
      lang?: string;
    }[];
    /** The name of the group, for screen readers. */
    label: string;
    /** Ties the buttons together; one per group on the page. */
    name: string;
  }>();

  const model = defineModel<string>({ required: true });
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="inline-flex flex-wrap gap-1 rounded-lg bg-surface-100 p-1 dark:bg-surface-800"
  >
    <label v-for="option in options" :key="option.value" class="relative">
      <!-- Over the whole segment, unseen, so a click anywhere chooses it. -->
      <input
        v-model="model"
        type="radio"
        class="peer absolute inset-0 m-0 cursor-pointer appearance-none opacity-0"
        :name="name"
        :value="option.value"
      />
      <span
        :lang="option.lang"
        class="pointer-events-none flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-surface-600 transition-colors peer-hover:text-surface-900 peer-checked:bg-surface-0 peer-checked:text-surface-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 dark:text-surface-300 dark:peer-hover:text-surface-0 dark:peer-checked:bg-surface-600 dark:peer-checked:text-surface-0 dark:peer-focus-visible:ring-primary-400"
      >
        <span v-if="option.icon" :class="option.icon" aria-hidden="true" />
        {{ option.label }}
      </span>
    </label>
  </div>
</template>
