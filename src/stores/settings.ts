import { defineStore } from 'pinia';
import { watch } from 'vue';
import { useStorage } from '@vueuse/core';
import { userRegion } from '@/util/region';

const COUNTRY = /^[A-Z]{2}$/;

/**
 * How big the interface is. 'auto' makes it a little bigger on a big screen
 * (style.css); a percentage keeps it at that size on any screen.
 */
export const UI_SIZES = ['auto', '90', '100', '110', '125'] as const;
export type UiSize = (typeof UI_SIZES)[number];

const isUiSize = (value: string): value is UiSize =>
  (UI_SIZES as readonly string[]).includes(value);

/**
 * What the user chose on the settings page that the language and the theme
 * (kept where the menu keeps them) do not cover: the country of where to
 * watch and the size of the interface. Kept in this window or browser, like
 * them.
 */
export const useSettingsStore = defineStore('settings', () => {
  /** A country code such as `BR`; '' follows the system (userRegion). */
  const region = useStorage('region', '');

  /** The country where to watch is about, for the language of the app. */
  const regionFor = (appLocale: string) =>
    COUNTRY.test(region.value) ? region.value : userRegion(appLocale);

  const uiSize = useStorage<string>('ui-size', 'auto');

  // The page reads it from <html data-ui-size> (style.css), where
  // public/theme.js puts it before the first paint.
  watch(
    uiSize,
    (size) => {
      const root = document.documentElement;

      if (isUiSize(size) && size !== 'auto') {
        root.dataset.uiSize = size;
      } else {
        delete root.dataset.uiSize;
      }
    },
    { immediate: true },
  );

  return { region, regionFor, uiSize };
});
