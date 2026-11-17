import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import { userRegion } from '@/util/region';

const COUNTRY = /^[A-Z]{2}$/;

/**
 * What the user chose on the settings page that the language and the theme
 * (kept where the menu keeps them) do not cover: the country of where to
 * watch. Kept in this window or browser, like them.
 */
export const useSettingsStore = defineStore('settings', () => {
  /** A country code such as `BR`; '' follows the system (userRegion). */
  const region = useStorage('region', '');

  /** The country where to watch is about, for the language of the app. */
  const regionFor = (appLocale: string) =>
    COUNTRY.test(region.value) ? region.value : userRegion(appLocale);

  return { region, regionFor };
});
