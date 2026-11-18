<script setup lang="ts">
  import '@fontsource/alfa-slab-one/latin-400.css';
  import { Logo } from '@/types';
  import LogoViewLink from './LogoViewLink.vue';

  defineProps<{
    item: Logo;
  }>();
</script>

<template>
  <!-- A tool of the app, as a card: its logo and its version. -->
  <div
    class="flex items-center gap-3 rounded-lg border border-surface-200 bg-surface-0 px-4 py-3 shadow-sm dark:border-surface-700 dark:bg-surface-900"
  >
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

<style>
  .waviy {
    position: relative;
    -webkit-box-reflect: below -20px
      linear-gradient(transparent, rgba(0, 0, 0, 0.2));
    font-size: 25px;
  }
  .waviy span {
    font-family: 'Alfa Slab One', cursive;
    position: relative;
    display: inline-block;
    text-transform: uppercase;
    animation: waviy 3s infinite;
    animation-delay: calc(0.1s * var(--i));
  }
  @keyframes waviy {
    0%,
    40%,
    100% {
      transform: translateY(0);
    }
    20% {
      transform: translateY(-20px);
    }
  }
</style>
