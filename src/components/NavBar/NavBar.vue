<script setup lang="ts">
  import Menubar from 'primevue/menubar';
  import { ref } from 'vue';
  import { ThemeItem } from './theme'
  import { LanguageItem } from './language'

  const { t, availableLocales, locale } = useI18n();

  const themeItem = new ThemeItem(t);
  const languageItem = new LanguageItem(availableLocales, locale);

  const items = ref([
    {
      label: 'Home',
      icon: 'pi pi-home',
      route: '/home'
    },
    {
      label: 'Features',
      icon: 'pi pi-star',
      route: '/about'
    },
    {
      label: 'Projects',
      icon: 'pi pi-search',
      items: [
        {
          label: 'Components',
          icon: 'pi pi-bolt',
          route: '/home'
        }
      ]
    },
    themeItem.getThemes(),
    languageItem.getLanguages()
  ]);
</script>

<template>
  <Menubar :model="items">
    <template #item="{ item, props, hasSubmenu }">
      <router-link v-if="item.route" v-slot="{ href, navigate }" :to="item.route" custom>
        <a v-ripple :href="href" v-bind="props.action" @click="navigate">
          <span :class="item.icon" />
          <span class="ml-2">{{ item.label }}</span>
        </a>
      </router-link>
      <a v-else v-ripple :href="item.url" :target="item.target" v-bind="props.action">
        <span :class="item.icon" />
        <span class="ml-2">{{ item.label }}</span>
        <span v-if="hasSubmenu" class="pi pi-fw pi-angle-down ml-2" />
      </a>
    </template>
  </Menubar>
</template>

