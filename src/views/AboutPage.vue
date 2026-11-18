<script setup lang="ts">
  import tmdbLogo from '@/assets/tmdb.svg';
  import LogoItem from '@/components/About/LogoItem.vue';
  import { DEPENDENCIES } from '@/util/constants';

  const { t } = useI18n();

  // In English in every language: it is the text of the terms, not ours.
  const TMDB_NOTICE =
    'This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.';

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
  ];
</script>

<template>
  <h1 class="page-title mt-8 text-center">{{ t('menu.about') }}</h1>

  <!-- One column on a phone, two from a tablet up -->
  <div
    class="grid grid-cols-[max-content] items-center justify-center gap-5 px-4 pt-[5%] sm:grid-cols-[repeat(2,minmax(0,16rem))]"
  >
    <LogoItem v-for="(item, index) in items" :key="index" :item="item" />
  </div>

  <!-- Asked by the terms of the TMDB API: its logo, kept smaller than what
  names the app, and its notice, word for word -->
  <section
    aria-labelledby="about-tmdb"
    class="mx-auto my-10 max-w-xl px-4 text-center"
  >
    <h2 id="about-tmdb" class="mb-3 text-xl">
      {{ t('about.dataTitle') }}
    </h2>
    <a href="https://www.themoviedb.org/" target="_blank" class="inline-block">
      <img :src="tmdbLogo" alt="The Movie Database (TMDB)" class="h-4" />
    </a>
    <p class="mt-3">
      {{ t('about.dataSource') }}
    </p>
    <p class="mt-2 text-sm" lang="en">
      {{ TMDB_NOTICE }}
    </p>
  </section>
</template>
