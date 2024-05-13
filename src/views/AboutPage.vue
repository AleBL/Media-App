<script setup lang="ts">
  import LogoItem from '@/components/About/LogoItem.vue';
  import { VERSIONS } from '@/util/constants';

  const items = [
    { href: 'https://www.electronjs.org/', imgSrc: 'electron.svg', imgAlt: 'Electron logo', version: VERSIONS.ELECTRON },
    { href: 'https://vitejs.dev/', imgSrc: 'vite.svg', imgAlt: 'Vite logo', version: VERSIONS.VITE },
    { href: 'https://vuejs.org/', imgSrc: 'vue.svg', imgAlt: 'Vue logo', version: VERSIONS.VUE },
    { href: 'https://pinia.vuejs.org/', imgSrc: 'pinia.svg', imgAlt: 'Pinia logo', version: VERSIONS.PINIA },
    { href: 'https://tailwindcss.com/', imgSrc: 'tailwindcss.png', imgAlt: 'Tailwind CSS logo', version: VERSIONS.TAILWINDCSS },
    { href: 'https://eslint.org/', imgSrc: 'eslint.png', imgAlt: 'Eslint logo', version: VERSIONS.ESLINT },
    { href: 'https://prettier.io/', imgSrc: 'prettier.png', imgAlt: 'Prettier logo', version: VERSIONS.PRETTIER },
    { href: 'https://vueuse.org/', imgSrc: 'vueuse.svg', imgAlt: 'VueUse logo', version: VERSIONS.VUEUSE },
    { href: 'https://nodejs.org/', imgSrc: 'node.svg', imgAlt: 'NodeJS logo', version: VERSIONS.NODE },
    { href: 'https://primevue.org/', imgSrc: 'prime.svg', imgAlt: 'Prime logo', version: VERSIONS.PRIMEVUE }
  ];
</script>

<template>
  <div class="gap-5 items-center justify-center" style="padding-top: 5%;display: grid; grid-template-columns: 20% 20%;">
    <LogoItem v-for="(item, index) in items" :key="index" :item="item" />
  </div>
</template>
