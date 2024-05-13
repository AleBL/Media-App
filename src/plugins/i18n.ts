import { createI18n } from 'vue-i18n';
import { useStorage } from '@vueuse/core';

export const defaultLocale = useStorage('locale', 'en');

const regex = /(?<=\/)[a-z]{2}(-[A-Z]{2})?(?=\.json)/g;

export const messages = Object.fromEntries(
  Object.entries(
    import.meta.glob<{ default: string }>('../locales/*.json', {
      eager: true,
    })
  ).map(([key, value]) => {
    return [key.match(regex)?.join(), value.default];
  })
);

const i18n = createI18n({
  legacy: false,
  locale: defaultLocale.value,
  fallbackLocale: defaultLocale.value,
  warnHtmlMessage: false,
  messages,
});

export default i18n;
