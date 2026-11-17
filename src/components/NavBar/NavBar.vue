<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useRoute } from 'vue-router';
  // The icon of the app, drawn once in build/ for the packages too.
  import appIcon from '../../../build/icon.svg';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppIconButton from '@/components/ui/AppIconButton.vue';
  import { useSessionStore } from '@/stores/session';
  import AccountMenu from './AccountMenu.vue';
  import LanguageMenu from './LanguageMenu.vue';
  import NavDrawer from './NavDrawer.vue';
  import { appLinks, mainLinks } from './links';
  import { NAV_LINK } from './menu';
  import { isDark, toggleTheme } from './theme';

  const { t } = useI18n();
  const route = useRoute();
  const session = useSessionStore();

  const pages = computed(() => mainLinks(t));
  const tools = computed(() => appLinks(t));

  // The icon says the theme in use, the hint what pressing it does.
  const themeIcon = computed(() => (isDark.value ? 'pi pi-moon' : 'pi pi-sun'));
  const themeLabel = computed(() =>
    t(isDark.value ? 'theme.toLight' : 'theme.toDark'),
  );

  // Narrow windows (below 1024px, where the bar no longer fits in one row
  // in every language) keep the pages in a drawer instead.
  const drawerOpen = ref(false);

  watch(
    () => route.fullPath,
    () => {
      drawerOpen.value = false;
    },
  );
</script>

<template>
  <!-- Stays at the top while the page scrolls. The name of the app leads
       home; then the pages, the tools as icons with a hint, and the
       account. -->
  <header
    class="sticky top-0 z-30 border-b border-surface-200 bg-surface-0/90 backdrop-blur-md dark:border-surface-700 dark:bg-surface-900/90"
  >
    <nav
      :aria-label="t('menu.label')"
      class="mx-auto flex h-16 max-w-7xl items-center gap-1 px-4"
    >
      <AppIconButton
        class="lg:hidden"
        icon="pi pi-bars"
        :label="t('menu.toggle')"
        :aria-expanded="drawerOpen"
        aria-haspopup="dialog"
        @click="drawerOpen = true"
      />

      <RouterLink
        to="/"
        class="mr-3 flex shrink-0 items-center gap-2 rounded-md font-semibold text-surface-900 no-underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-surface-0"
      >
        <img :src="appIcon" alt="" class="h-8 w-8 rounded-lg" />
        <span>Media App</span>
      </RouterLink>

      <ul class="m-0 hidden list-none gap-1 p-0 lg:flex">
        <li v-for="link in pages" :key="link.to">
          <RouterLink :to="link.to" :class="NAV_LINK">
            <span :class="link.icon" aria-hidden="true" />
            {{ link.label }}
          </RouterLink>
        </li>
      </ul>

      <div class="ml-auto flex items-center gap-1">
        <div class="hidden items-center gap-1 lg:flex">
          <AppIconButton
            :icon="themeIcon"
            :label="themeLabel"
            @click="toggleTheme()"
          />
          <LanguageMenu />
          <AppIconButton
            v-for="link in tools"
            :key="link.to"
            :icon="link.icon"
            :label="link.label"
            :to="link.to"
            class="aria-[current=page]:bg-primary-50 aria-[current=page]:text-primary-800 dark:aria-[current=page]:bg-primary-950 dark:aria-[current=page]:text-primary-200"
          />
        </div>

        <AccountMenu v-if="session.account" class="ml-1" />
        <AppButton
          v-else
          class="ml-1"
          to="/account"
          icon="pi pi-sign-in"
          :label="t('account.signIn')"
        />
      </div>
    </nav>

    <NavDrawer v-model:open="drawerOpen" />
  </header>
</template>
