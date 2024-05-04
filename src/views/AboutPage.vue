<script setup lang="ts">
  import LogoViewLink from '../components/LogoViewLink.vue';

  const { t } = useI18n();
</script>

<template>
  <div class="flex flex-wrap gap-5 items-center justify-center">
    <LogoViewLink
      href="https://www.electronjs.org/"
      img-src="electron.svg"
      img-alt="Electron logo"
    />
    <LogoViewLink
      href="https://vitejs.dev/"
      img-src="vite.svg"
      img-alt="Vite logo"
    />
    <LogoViewLink
      href="https://vuejs.org/"
      img-src="vue.svg"
      img-alt="Vue logo"
    />
    <LogoViewLink
      href="https://pinia.vuejs.org/"
      img-src="pinia.svg"
      img-alt="Pinia logo"
    />
    <LogoViewLink
      href="https://tailwindcss.com/"
      img-src="tailwindcss.png"
      img-alt="Tailwind CSS logo"
    />
    <LogoViewLink
      href="https://eslint.org/"
      img-src="eslint.png"
      img-alt="Eslint logo"
    />
    <LogoViewLink
      href="https://prettier.io/"
      img-src="prettier.png"
      img-alt="Prettier logo"
    />
    <LogoViewLink
      href="https://vueuse.org/"
      img-src="vueuse.svg"
      img-alt="VueUse logo"
    />
  </div>

  <div class="text-center">
    <h1 class="text-2xl">
      {{ t('pageTitles.about') }}
    </h1>
  </div>
</template>
