<script setup lang="ts">
  import Menubar from 'primevue/menubar';
  import { ref } from 'vue';
  import { isDesktop } from '@/services/api';
  import { useSessionStore } from '@/stores/session';
  import { ThemeItem } from './theme';
  import { LanguageItem } from './language';

  const { t, availableLocales, locale } = useI18n();
  const session = useSessionStore();

  const themeItem = new ThemeItem(t);
  const languageItem = new LanguageItem(availableLocales, locale);

  const currentLocaleBand = computed(() => {
    return new URL(languageItem.getCurrentLocaleIcon(), import.meta.url).href;
  });

  const menus = ref([
    {
      label: computed(() => {
        return t('pageTitles.home');
      }),
      icon: 'pi pi-home',
      route: '/home',
    },
    {
      label: computed(() => {
        return `${t('pageTitles.search')}`;
      }),
      icon: 'pi pi-search',
      route: '/search',
    },
    themeItem.getThemes(),
    languageItem.getLanguages(),
    // The only setting so far is the user's own TMDB key, which a web page
    // has no safe place to keep.
    ...(isDesktop()
      ? [
          {
            label: computed(() => {
              return t('pageTitles.settings');
            }),
            icon: 'pi pi-cog',
            route: '/settings',
          },
        ]
      : []),
    {
      label: computed(() => {
        return t('pageTitles.about');
      }),
      icon: 'pi pi-info-circle',
      route: '/about',
    },
    {
      label: computed(() => {
        const account = session.account;

        return account
          ? (account.name ?? account.username)
          : t('account.signIn');
      }),
      icon: computed(() => {
        return session.account ? 'pi pi-user' : 'pi pi-sign-in';
      }),
      route: '/account',
    },
  ]);
</script>

<template>
  <Menubar :model="menus">
    <template #item="{ item, props, hasSubmenu }">
      <router-link
        v-if="item.route"
        v-slot="{ href, navigate }"
        :to="item.route"
        custom
      >
        <a v-ripple :href="href" v-bind="props.action" @click="navigate">
          <span :class="item.icon" />
          <span class="ml-2">{{ item.label }}</span>
        </a>
      </router-link>
      <a
        v-else
        v-ripple
        :href="item.url"
        :target="item.target"
        v-bind="props.action"
      >
        <span
          v-if="item.imageURL"
          class="menubar-icon"
          :style="{ backgroundImage: `url(${item.imageURL})` }"
        />
        <span v-else :class="item.icon" />
        <span class="ml-2">{{ item.label }}</span>
        <img
          v-if="item.showBand"
          class="menubar-icon"
          :src="currentLocaleBand"
          alt="Band"
        />
        <span v-if="hasSubmenu" class="pi pi-fw pi-angle-down ml-2" />
      </a>
    </template>
  </Menubar>
</template>

<style lang="scss">
  @import '@/style/nav_bar.css';
</style>
