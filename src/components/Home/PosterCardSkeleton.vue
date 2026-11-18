<script setup lang="ts">
  import AppSkeleton from '@/components/ui/AppSkeleton.vue';
</script>

<template>
  <!-- The shape of a PosterCard while its title loads: the poster, the
       name and the line of the year and the rating. -->
  <div class="w-full" aria-hidden="true">
    <AppSkeleton class="aspect-[2/3] w-full" />
    <AppSkeleton class="mt-2 h-4 w-4/5" />
    <AppSkeleton class="mt-1.5 h-3 w-1/2" />
  </div>
</template>
