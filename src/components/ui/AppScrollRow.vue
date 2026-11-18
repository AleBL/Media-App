<script setup lang="ts">
  import { ref } from 'vue';
  import { usePreferredReducedMotion, useScroll } from '@vueuse/core';
  import AppIconButton from './AppIconButton.vue';

  // A row of cards that scrolls sideways: the cards go in the default slot,
  // as <li>. A mouse without a wheel that goes sideways has the arrows,
  // which show on hover and on focus, and only where there is more.
  defineProps<{
    /** Loading again: the row stays readable. */
    busy?: boolean;
    previousLabel: string;
    nextLabel: string;
  }>();

  const row = ref<HTMLElement>();
  const { arrivedState } = useScroll(row);
  const motion = usePreferredReducedMotion();

  // About a screen of cards at a time; the cards snap into place.
  function move(direction: 1 | -1) {
    row.value?.scrollBy({
      left: direction * row.value.clientWidth * 0.8,
      behavior: motion.value === 'reduce' ? 'auto' : 'smooth',
    });
  }

  const ARROW =
    'absolute top-[38%] z-20 -translate-y-1/2 rounded-full bg-surface-0/90 shadow-md opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100 dark:bg-surface-800/90';
</script>

<template>
  <div class="group/row relative">
    <div v-if="!arrivedState.left" :class="[ARROW, 'left-1']">
      <AppIconButton
        icon="pi pi-angle-left"
        :label="previousLabel"
        @click="move(-1)"
      />
    </div>

    <ul
      ref="row"
      class="m-0 mt-4 flex snap-x list-none gap-4 overflow-x-auto scroll-smooth p-0 pb-3 motion-reduce:scroll-auto"
      :aria-busy="busy"
    >
      <slot />
    </ul>

    <div v-if="!arrivedState.right" :class="[ARROW, 'right-1']">
      <AppIconButton
        icon="pi pi-angle-right"
        :label="nextLabel"
        @click="move(1)"
      />
    </div>
  </div>
</template>
