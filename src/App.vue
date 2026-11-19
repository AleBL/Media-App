<script setup lang="ts">
  import NavBar from './components/NavBar/NavBar.vue';
  import AppToaster from './components/ui/AppToaster.vue';
  import UpdateBanner from './components/Updates/UpdateBanner.vue';
  import { useSettingsStore } from './stores/settings';

  // From the start: it keeps the size of the interface on the page.
  useSettingsStore();
</script>

<template>
  <NavBar />
  <UpdateBanner />
  <!-- Each page fades in; the one before goes at once, so there are never
       two of them, and the place a page scrolled to stays right. Another
       search or another title on the same page does not fade. -->
  <RouterView v-slot="{ Component, route }">
    <div
      :key="String(route.name)"
      class="animate-page-in motion-reduce:animate-none"
    >
      <component :is="Component" />
    </div>
  </RouterView>
  <AppToaster />
</template>
