<script setup lang="ts">
  import { computed } from 'vue';
  import {
    DialogClose,
    DialogContent,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
  } from 'reka-ui';
  import appIcon from '../../../build/icon.svg';
  import AppButton from '@/components/ui/AppButton.vue';
  import { useSessionStore } from '@/stores/session';
  import { chooseLanguage, flagOf, languageName } from './language';
  import { accountLinks, appLinks, mainLinks } from './links';
  import { NAV_LINK } from './menu';
  import { isDark, toggleTheme } from './theme';

  const open = defineModel<boolean>('open', { required: true });

  const { t, locale, availableLocales } = useI18n();
  const session = useSessionStore();

  // Everything of the bar, in one column: the pages, then the account,
  // then the theme and the language.
  const links = computed(() => [
    ...mainLinks(t),
    ...(session.account ? accountLinks(t) : []),
    ...appLinks(t),
  ]);

  const choose = (code: string) => chooseLanguage(locale, code);

  function signOut() {
    open.value = false;
    void session.logout();
  }
</script>

<template>
  <!-- The menu of narrow windows: a panel from the side that keeps the
       focus while open and closes with Esc, a click outside or a choice. -->
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-surface-950/40 lg:hidden" />
      <DialogContent
        :aria-describedby="undefined"
        class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto bg-surface-0 p-4 shadow-xl focus:outline-hidden lg:hidden dark:bg-surface-900"
      >
        <div class="flex items-center justify-between">
          <DialogTitle
            class="flex items-center gap-2 text-base font-semibold text-surface-900 dark:text-surface-0"
          >
            <img :src="appIcon" alt="" class="h-7 w-7 rounded-md" />
            MoviLedger
          </DialogTitle>
          <DialogClose as-child>
            <AppButton
              severity="ghost"
              icon="pi pi-times"
              :aria-label="t('menu.close')"
            />
          </DialogClose>
        </div>

        <nav :aria-label="t('menu.label')">
          <ul class="m-0 flex list-none flex-col gap-1 p-0">
            <li v-for="link in links" :key="link.to">
              <RouterLink :to="link.to" :class="NAV_LINK" @click="open = false">
                <span :class="link.icon" aria-hidden="true" />
                {{ link.label }}
              </RouterLink>
            </li>
            <li v-if="!session.account">
              <RouterLink to="/account" :class="NAV_LINK" @click="open = false">
                <span class="pi pi-sign-in" aria-hidden="true" />
                {{ t('account.signIn') }}
              </RouterLink>
            </li>
          </ul>
        </nav>

        <div
          class="mt-auto flex flex-col gap-3 border-t border-surface-200 pt-4 dark:border-surface-700"
        >
          <AppButton
            severity="ghost"
            class="justify-start"
            :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
            :label="t(isDark ? 'theme.toLight' : 'theme.toDark')"
            @click="toggleTheme()"
          />

          <fieldset>
            <legend
              class="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400"
            >
              {{ t('language.label') }}
            </legend>
            <label
              v-for="code in availableLocales"
              :key="code"
              :class="[
                NAV_LINK,
                'cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500',
              ]"
              :lang="code"
            >
              <input
                type="radio"
                name="drawer-language"
                class="sr-only"
                :value="code"
                :checked="locale === code"
                @change="choose(code)"
              />
              <img :src="flagOf(code)" alt="" class="h-5 w-5" />
              <span class="flex-1">{{ languageName(code) }}</span>
              <span
                v-if="locale === code"
                class="pi pi-check text-xs"
                aria-hidden="true"
              />
            </label>
          </fieldset>

          <AppButton
            v-if="session.account"
            severity="ghost"
            class="justify-start"
            icon="pi pi-sign-out"
            :label="t('account.signOut')"
            @click="signOut"
          />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
