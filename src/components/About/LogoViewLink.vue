<script setup lang="ts">
  const props = defineProps<{
    href: string;
    imgSrc: string;
    imgAlt: string;
  }>();

  const imageUrl = new URL(`/src/assets/${props.imgSrc}`, import.meta.url).href;
</script>

<template>
  <a :href="props.href" target="_blank">
    <img
      :src="imageUrl"
      class="logo h-16 p-1.5 transition-[filter] duration-300 will-change-[filter]"
      :alt="props.imgAlt"
    />
  </a>
</template>

<style scoped>
  .logo:hover {
    filter: drop-shadow(0 0 10px gray);
  }
</style>
