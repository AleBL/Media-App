<script setup lang="ts">
  import {
    TooltipContent,
    TooltipPortal,
    TooltipProvider,
    TooltipRoot,
    TooltipTrigger,
  } from 'reka-ui';

  withDefaults(
    defineProps<{
      text: string;
      side?: 'top' | 'right' | 'bottom' | 'left';
    }>(),
    { side: 'bottom' },
  );
</script>

<template>
  <!-- A short hint on hover and on keyboard focus, for the element in the
       default slot. It describes, it does not name: a button of only an
       icon still needs its own aria-label. Reka UI keeps it accessible
       (role="tooltip", Esc closes it). -->
  <TooltipProvider :delay-duration="300">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="side"
          :side-offset="6"
          class="z-50 rounded-md bg-surface-900 px-2 py-1 text-xs font-medium text-white shadow-md dark:bg-surface-0 dark:text-surface-900"
        >
          {{ text }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
