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
