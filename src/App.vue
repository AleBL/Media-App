<script setup lang="ts">
  import NavBar from './components/NavBar/NavBar.vue';
  console.log(
    '[App.vue]',
    `Hello world from Electron ${process.versions.electron}!`
  );

  const { t } = useI18n();
</script>

<template>
  <NavBar></NavBar>

  <div id="app" class="max-w-5xl mx-auto px-4 py-5 dark:bg-slate-800 dark:text-gray-200 min-h-screen">

    <p class="text-center mt-6 flex items-center justify-center">
      <router-link
        to="/home"
        class="block mx-4 px-2 py-1 border-b-2 border-green-300 hover:border-green-500 transition"
      >
        {{ t('homepage.goToHome') }}
      </router-link>
      <router-link
        to="/about"
        class="block mx-4 px-2 py-1 border-b-2 border-green-300 hover:border-green-500 transition"
      >
        {{ t('aboutPage.goToAbout') }}
      </router-link>
    </p>

    <router-view class="my-5" />

    <div class="flex items-center justify-center mt-4">
      <span v-html="t('footer.placeStaticFiles')" />
      <img src="/node.svg" alt="Node logo" class="w-10" />
    </div>
  </div>
</template>
