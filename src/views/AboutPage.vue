<script setup lang="ts">
  import LogoItem from '@/components/About/LogoItem.vue';
  import { DEPENDENCIES } from '@/util/constants';

  const items = [
    {
      href: DEPENDENCIES.ELECTRON.LINK,
      imgSrc: DEPENDENCIES.ELECTRON.LOGO,
      imgAlt: 'Electron logo',
      version: DEPENDENCIES.ELECTRON.VERSION,
    },
    {
      href: DEPENDENCIES.VITE.LINK,
      imgSrc: DEPENDENCIES.VITE.LOGO,
      imgAlt: 'Vite logo',
      version: DEPENDENCIES.VITE.VERSION,
    },
    {
      href: DEPENDENCIES.VUE.LINK,
      imgSrc: DEPENDENCIES.VUE.LOGO,
      imgAlt: 'Vue logo',
      version: DEPENDENCIES.VUE.VERSION,
    },
    {
      href: DEPENDENCIES.PINIA.LINK,
      imgSrc: DEPENDENCIES.PINIA.LOGO,
      imgAlt: 'Pinia logo',
      version: DEPENDENCIES.PINIA.VERSION,
    },
    {
      href: DEPENDENCIES.TAILWINDCSS.LINK,
      imgSrc: DEPENDENCIES.TAILWINDCSS.LOGO,
      imgAlt: 'Tailwind CSS logo',
      version: DEPENDENCIES.TAILWINDCSS.VERSION,
    },
    {
      href: DEPENDENCIES.ESLINT.LINK,
      imgSrc: DEPENDENCIES.ESLINT.LOGO,
      imgAlt: 'Eslint logo',
      version: DEPENDENCIES.ESLINT.VERSION,
    },
    {
      href: DEPENDENCIES.PRETTIER.LINK,
      imgSrc: DEPENDENCIES.PRETTIER.LOGO,
      imgAlt: 'Prettier logo',
      version: DEPENDENCIES.PRETTIER.VERSION,
    },
    {
      href: DEPENDENCIES.VUEUSE.LINK,
      imgSrc: DEPENDENCIES.VUEUSE.LOGO,
      imgAlt: 'VueUse logo',
      version: DEPENDENCIES.VUEUSE.VERSION,
    },
    {
      href: DEPENDENCIES.NODE.LINK,
      imgSrc: DEPENDENCIES.NODE.LOGO,
      imgAlt: 'NodeJS logo',
      version: DEPENDENCIES.NODE.VERSION,
    },
    {
      href: DEPENDENCIES.PRIMEVUE.LINK,
      imgSrc: DEPENDENCIES.PRIMEVUE.LOGO,
      imgAlt: 'Prime logo',
      version: DEPENDENCIES.PRIMEVUE.VERSION,
    },
  ];
</script>

<template>
  <div
    class="items-center justify-center gap-5"
    style="padding-top: 5%; display: grid; grid-template-columns: 20% 20%"
  >
    <LogoItem v-for="(item, index) in items" :key="index" :item="item" />
  </div>
</template>
