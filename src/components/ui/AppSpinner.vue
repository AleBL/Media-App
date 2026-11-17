<script setup lang="ts">
  withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' });

  const SIZES = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-10 w-10 border-[3px]',
  };
</script>

<template>
  <!-- Only a picture: whoever shows it says what is loading (aria-busy, a
       status). With reduced motion it turns slowly instead of stopping, as
       a still ring would not say that something is happening. -->
  <span
    aria-hidden="true"
    :class="[
      'inline-block shrink-0 animate-spin rounded-full border-current border-r-transparent motion-reduce:animate-[spin_2s_linear_infinite]',
      SIZES[size],
    ]"
  />
</template>
