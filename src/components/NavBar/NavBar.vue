<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { onClickOutside, onKeyStroke } from '@vueuse/core';
  import { useSessionStore } from '@/stores/session';
  import { avatarUrl } from '@/util/images';
  import { ThemeItem } from './theme';
  import { LanguageItem, type LanguageOption } from './language';

  const { t, availableLocales, locale } = useI18n();
  const session = useSessionStore();

  const {
    label: themeLabel,
    icon: themeIcon,
    command: toggleTheme,
  } = new ThemeItem(t).getThemes();
  const languageItem = new LanguageItem(availableLocales, locale);
  const languages = languageItem.getLanguages().items;

  const currentLocaleBand = computed(() => {
    return new URL(languageItem.getCurrentLocaleIcon(), import.meta.url).href;
  });

  const leading = computed(() => [
    { to: '/home', icon: 'pi pi-home', label: t('pageTitles.home') },
    { to: '/search', icon: 'pi pi-search', label: t('pageTitles.search') },
  ]);

  const trailing = computed(() => {
    const account = session.account;

    return [
      { to: '/settings', icon: 'pi pi-cog', label: t('pageTitles.settings') },
      { to: '/about', icon: 'pi pi-info-circle', label: t('pageTitles.about') },
      ...(account
        ? []
        : [
            {
              to: '/account',
              icon: 'pi pi-sign-in',
              label: t('account.signIn'),
            },
          ]),
    ];
  });

  // Whoever signed in has a menu of their own, under their name.
  const accountLinks = computed(() => [
    { to: '/watchlist', icon: 'pi pi-bookmark', label: t('lists.watchlist') },
    { to: '/favorites', icon: 'pi pi-heart', label: t('lists.favorites') },
    { to: '/rated', icon: 'pi pi-star', label: t('lists.rated') },
    { to: '/watched', icon: 'pi pi-eye', label: t('lists.watched') },
    { to: '/account', icon: 'pi pi-user', label: t('pageTitles.account') },
  ]);
  const avatar = computed(() =>
    session.account?.avatarPath ? avatarUrl(session.account.avatarPath) : null,
  );

  // Narrow windows (the web version on a phone) fold the menu behind a
  // button. It, the languages and the account are disclosures: a button
  // that shows and hides what follows it, the pattern meant for navigation.
  const menuOpen = ref(false);
  const languagesOpen = ref(false);
  const languageMenu = ref<HTMLElement>();
  const languageButton = ref<HTMLButtonElement>();
  const accountOpen = ref(false);
  const accountMenu = ref<HTMLElement>();
  const accountButton = ref<HTMLButtonElement>();

  onClickOutside(languageMenu, () => {
    languagesOpen.value = false;
  });

  onClickOutside(accountMenu, () => {
    accountOpen.value = false;
  });

  onKeyStroke('Escape', () => {
    if (languagesOpen.value) {
      languagesOpen.value = false;
      languageButton.value?.focus();
    }

    if (accountOpen.value) {
      accountOpen.value = false;
      accountButton.value?.focus();
    }
  });

  function chooseLanguage(language: LanguageOption) {
    language.command();
    languagesOpen.value = false;
    menuOpen.value = false;
  }

  function closeMenus() {
    accountOpen.value = false;
    menuOpen.value = false;
  }

  async function signOut() {
    closeMenus();
    await session.logout();
  }

  // In the green of the links of the app, as with PrimeVue.
  const ITEM =
    'flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2 font-medium text-[#42b983] no-underline transition-all duration-200 hover:bg-surface-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 sm:w-auto sm:text-sm dark:hover:bg-surface-800 dark:focus-visible:ring-primary-400';
  const CURRENT =
    'aria-[current=page]:bg-surface-100 dark:aria-[current=page]:bg-surface-700';
</script>

<template>
  <header>
    <nav
      :aria-label="t('menu.label')"
      class="relative z-20 flex min-h-[4rem] items-center gap-6 rounded-md bg-surface-0 px-6 shadow-md ring-1 ring-inset ring-surface-100 dark:bg-surface-900 dark:ring-surface-800"
    >
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-full text-surface-500 transition duration-200 hover:bg-surface-50 hover:text-surface-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 sm:hidden dark:text-white/80 dark:hover:bg-surface-800/80 dark:hover:text-white/80"
        :aria-label="t('menu.toggle')"
        :aria-expanded="menuOpen"
        aria-controls="main-menu"
        @click="menuOpen = !menuOpen"
      >
        <span class="pi pi-bars" aria-hidden="true" />
      </button>

      <ul
        id="main-menu"
        :class="[
          menuOpen ? 'flex' : 'hidden',
          'absolute left-0 top-full z-10 m-0 w-full list-none flex-col gap-1 rounded-md bg-surface-0 px-1.5 py-2 shadow-md dark:bg-surface-900',
          'sm:relative sm:left-auto sm:top-auto sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:rounded-none sm:bg-transparent sm:p-0 sm:shadow-none dark:sm:bg-transparent',
        ]"
      >
        <li v-for="link in leading" :key="link.to">
          <RouterLink
            :to="link.to"
            :class="[ITEM, CURRENT]"
            @click="menuOpen = false"
          >
            <span :class="link.icon" aria-hidden="true" />
            <span class="ml-2">{{ link.label }}</span>
          </RouterLink>
        </li>

        <li>
          <button type="button" :class="ITEM" @click="toggleTheme">
            <span :class="themeIcon" aria-hidden="true" />
            <span class="ml-2">{{ themeLabel }}</span>
          </button>
        </li>

        <li ref="languageMenu" class="sm:relative">
          <button
            ref="languageButton"
            type="button"
            :class="ITEM"
            :aria-expanded="languagesOpen"
            aria-controls="language-menu"
            @click="languagesOpen = !languagesOpen"
          >
            <span class="pi pi-language" aria-hidden="true" />
            <span class="sr-only">{{ t('language.label') }}</span>
            <img class="ml-2 h-6 w-6" :src="currentLocaleBand" alt="" />
            <span class="pi pi-fw pi-angle-down ml-2" aria-hidden="true" />
          </button>

          <ul
            v-show="languagesOpen"
            id="language-menu"
            class="static z-10 m-0 w-full list-none rounded-md bg-surface-0 py-1 sm:absolute sm:w-48 sm:shadow-md dark:bg-surface-900"
          >
            <li v-for="language in languages" :key="language.label">
              <button
                type="button"
                :class="ITEM"
                :lang="language.label"
                :aria-current="language.label === locale ? 'true' : undefined"
                @click="chooseLanguage(language)"
              >
                <!-- An <img>: as a CSS background, the flags inlined as
                     data: addresses by the build never showed. -->
                <img class="h-6 w-6" :src="language.imageURL" alt="" />
                <span class="ml-2">{{ language.label }}</span>
              </button>
            </li>
          </ul>
        </li>

        <li v-for="link in trailing" :key="link.to">
          <RouterLink
            :to="link.to"
            :class="[ITEM, CURRENT]"
            @click="menuOpen = false"
          >
            <span :class="link.icon" aria-hidden="true" />
            <span class="ml-2">{{ link.label }}</span>
          </RouterLink>
        </li>

        <li v-if="session.account" ref="accountMenu" class="sm:relative">
          <button
            ref="accountButton"
            type="button"
            :class="ITEM"
            :aria-expanded="accountOpen"
            aria-controls="account-menu"
            @click="accountOpen = !accountOpen"
          >
            <img
              v-if="avatar"
              :src="avatar"
              alt=""
              class="h-6 w-6 rounded-full object-cover"
            />
            <span v-else class="pi pi-user" aria-hidden="true" />
            <span class="ml-2">{{
              session.account.name ?? session.account.username
            }}</span>
            <span class="pi pi-fw pi-angle-down ml-2" aria-hidden="true" />
          </button>

          <ul
            v-show="accountOpen"
            id="account-menu"
            class="static z-10 m-0 w-full list-none rounded-md bg-surface-0 py-1 sm:absolute sm:right-0 sm:w-48 sm:shadow-md dark:bg-surface-900"
          >
            <li v-for="link in accountLinks" :key="link.to">
              <RouterLink
                :to="link.to"
                :class="[ITEM, CURRENT]"
                @click="closeMenus"
              >
                <span :class="link.icon" aria-hidden="true" />
                <span class="ml-2">{{ link.label }}</span>
              </RouterLink>
            </li>
            <li>
              <button type="button" :class="ITEM" @click="signOut">
                <span class="pi pi-sign-out" aria-hidden="true" />
                <span class="ml-2">{{ t('account.signOut') }}</span>
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  </header>
</template>
