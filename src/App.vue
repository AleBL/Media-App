<script setup lang="ts">
  import NavBar from './components/NavBar/NavBar.vue';
  import AppToaster from './components/ui/AppToaster.vue';
  import UpdateBanner from './components/Updates/UpdateBanner.vue';
</script>

<template>
  <NavBar />
  <UpdateBanner />
  <RouterView />
  <AppToaster />
</template>
