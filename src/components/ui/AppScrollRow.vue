<script setup lang="ts">
  import { ref } from 'vue';
  import {
    usePreferredReducedMotion,
    useResizeObserver,
    useScroll,
  } from '@vueuse/core';

  // A row of cards that scrolls sideways: the cards go in the default slot,
  // as <li>. It has no bar of the system, which on Windows is a thick gray
  // one under each row: the sides with more to see fade out, and a mouse
  // without a wheel that goes sideways has the arrows, which show on hover
  // and on focus. A touch screen swipes, and has no arrows.
  defineProps<{
    /** Loading again: the row stays readable. */
    busy?: boolean;
    previousLabel: string;
    nextLabel: string;
  }>();

  const row = ref<HTMLElement>();
  const { arrivedState, measure } = useScroll(row);
  const motion = usePreferredReducedMotion();

  // A wider or narrower window can show it all, or no longer.
  useResizeObserver(row, () => measure());

  // About a screen of cards at a time; the cards snap into place.
  function move(direction: 1 | -1) {
    row.value?.scrollBy({
      left: direction * row.value.clientWidth * 0.8,
      behavior: motion.value === 'reduce' ? 'auto' : 'smooth',
    });
  }

  // Over the middle of the pictures, apart from the text under them.
  const ARROW =
    'absolute top-[40%] z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface-0/95 text-surface-800 opacity-0 shadow-lg ring-1 ring-surface-900/10 transition-opacity group-hover/row:opacity-100 hover:bg-surface-0 focus-visible:opacity-100 pointer-coarse:hidden dark:bg-surface-900/95 dark:text-surface-0 dark:ring-surface-0/15 dark:hover:bg-surface-900';
</script>

<template>
  <div class="group/row relative">
    <button
      v-if="!arrivedState.left"
      type="button"
      :class="[ARROW, 'left-1']"
      :aria-label="previousLabel"
      @click="move(-1)"
    >
      <span class="pi pi-chevron-left" aria-hidden="true" />
    </button>

    <!-- The cards snap clear of the faded side, so the one in front is
         never under it. -->
    <ul
      ref="row"
      :class="[
        'no-scrollbar fade-x m-0 mt-3 flex snap-x scroll-px-12 list-none gap-4 overflow-x-auto scroll-smooth py-1 motion-reduce:scroll-auto',
        !arrivedState.left && '[--fade-left:3rem]',
        !arrivedState.right && '[--fade-right:3rem]',
      ]"
      :aria-busy="busy"
    >
      <slot />
    </ul>

    <button
      v-if="!arrivedState.right"
      type="button"
      :class="[ARROW, 'right-1']"
      :aria-label="nextLabel"
      @click="move(1)"
    >
      <span class="pi pi-chevron-right" aria-hidden="true" />
    </button>
  </div>
</template>
