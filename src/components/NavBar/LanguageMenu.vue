<script setup lang="ts">
  import { computed } from 'vue';
  import {
    DropdownMenuContent,
    DropdownMenuItemIndicator,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
  } from 'reka-ui';
  import AppButton from '@/components/ui/AppButton.vue';
  import { chooseLanguage, flagOf, languageName } from './language';
  import { MENU, MENU_ITEM } from './menu';

  const { t, locale, availableLocales } = useI18n();

  const choice = computed({
    get: () => locale.value,
    set: (code: string) => chooseLanguage(locale, code),
  });
</script>

<template>
  <!-- Each language by its own name, the one in use checked. No hint
       around the button: a tooltip there would take the place of the menu
       in the positioning of Reka UI, and the icon and the flag say enough. -->
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <AppButton
        severity="ghost"
        icon="pi pi-language"
        :aria-label="t('language.label')"
        class="px-2"
      >
        <img :src="flagOf(locale)" alt="" class="h-5 w-5" />
        <span class="pi pi-angle-down text-xs" aria-hidden="true" />
      </AppButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent align="end" :side-offset="6" :class="MENU">
        <DropdownMenuRadioGroup v-model="choice">
          <DropdownMenuRadioItem
            v-for="code in availableLocales"
            :key="code"
            :value="code"
            :lang="code"
            :class="MENU_ITEM"
          >
            <img :src="flagOf(code)" alt="" class="h-5 w-5" />
            <span class="flex-1">{{ languageName(code) }}</span>
            <DropdownMenuItemIndicator>
              <span class="pi pi-check text-xs" aria-hidden="true" />
            </DropdownMenuItemIndicator>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
