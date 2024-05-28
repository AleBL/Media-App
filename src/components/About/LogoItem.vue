<script setup lang="ts">
  import { Logo } from '@/types';
  import LogoViewLink from './LogoViewLink.vue';

  defineProps<{
    item: Logo;
  }>();

  function getSpanVersion(version) {
    const versionSplited = version.split('');
    const spans = versionSplited.map(
      (item, index) => `<span style="--i:${index + 1}">${item}</span>`
    );

    return `${spans.join('')}`;
  }
</script>

<template>
  <div style="align-items: center; display: flex">
    <LogoViewLink
      :href="item.href"
      :img-src="item.imgSrc"
      :img-alt="item.imgAlt"
    />
    <div class="waviy" v-html="getSpanVersion(item.version)" />
  </div>
</template>

<style lang="scss">
  @import '@/style/logo_item.css';
</style>
