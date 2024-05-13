<script setup lang="ts">
  import NavBar from './components/NavBar/NavBar.vue';

  console.log(
    '[App.vue]',
    `Hello world from Electron ${process.versions.electron}!`
  );
</script>

<template>
  <NavBar></NavBar>
  <RouterView />
</template>
