<script setup lang="ts">
  import { Logo } from '@/types';
  import LogoViewLink from './LogoViewLink.vue';

  defineProps<{
    item: Logo;
  }>();
</script>

<template>
  <div style="align-items: center; display: flex">
    <LogoViewLink
      :href="item.href"
      :img-src="item.imgSrc"
      :img-alt="item.imgAlt"
    />
    <div class="waviy">
      <span
        v-for="(character, index) in item.version"
        :key="index"
        :style="{ '--i': index + 1 }"
        >{{ character }}</span
      >
    </div>
  </div>
</template>

<style lang="scss">
  @import '@/style/logo_item.css';
</style>
