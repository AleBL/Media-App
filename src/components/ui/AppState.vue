<script setup lang="ts">
  withDefaults(
    defineProps<{
      /** An error is announced at once; anything else when it can be. */
      tone?: 'neutral' | 'error';
      /** A PrimeIcons class. */
      icon?: string;
      title?: string;
    }>(),
    { tone: 'neutral', icon: undefined, title: undefined },
  );
</script>

<template>
  <!-- What a page says instead of its content: nothing found, nothing yet,
       or a failure. The message is the default slot, and the buttons (try
       again, open the settings) the actions slot. -->
  <div
    :role="tone === 'error' ? 'alert' : 'status'"
    class="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-10 text-center"
  >
    <span
      v-if="icon"
      :class="[
        icon,
        'text-4xl',
        tone === 'error'
          ? 'text-red-500 dark:text-red-400'
          : 'text-surface-400 dark:text-surface-500',
      ]"
      aria-hidden="true"
    />
    <p
      v-if="title"
      class="text-lg font-semibold text-surface-900 dark:text-surface-0"
    >
      {{ title }}
    </p>
    <p
      :class="
        tone === 'error'
          ? 'text-red-600 dark:text-red-400'
          : 'text-surface-600 dark:text-surface-300'
      "
    >
      <slot />
    </p>
    <div v-if="$slots.actions" class="mt-2 flex flex-wrap justify-center gap-3">
      <slot name="actions" />
    </div>
  </div>
</template>
