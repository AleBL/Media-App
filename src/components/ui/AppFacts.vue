<script setup lang="ts">
  // Facts in a line, such as "2008 · 47 min · Drama", which wraps without
  // a "·" at the start of a line. Each fact brings its dot, in a space as
  // wide as --fact-gap (1em unless the page says otherwise); the list starts
  // that far past its left edge, which clips it, so the dot of the first
  // fact of each line is out of sight. Clipping only there, 4px short, keeps
  // the focus ring of what comes first, such as the age rating. A screen
  // reader hears a list, without the dots.
  defineProps<{
    facts: string[];
  }>();
</script>

<template>
  <ul
    class="-ml-[var(--fact-gap,1em)] flex list-none flex-wrap items-center p-0 [clip-path:inset(-1rem_-1rem_-1rem_calc(var(--fact-gap,1em)_-_4px))] [&>li]:flex [&>li]:items-baseline [&>li]:before:w-[var(--fact-gap,1em)] [&>li]:before:shrink-0 [&>li]:before:text-center [&>li]:before:content-['·'_/_'']"
  >
    <slot />
    <li v-for="fact in facts" :key="fact">{{ fact }}</li>
  </ul>
</template>
