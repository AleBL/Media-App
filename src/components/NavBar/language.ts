import type { Ref } from 'vue';
import { defaultLocale } from '@/plugins/i18n';

// The flags of the languages, by locale: src/assets/locales/pt-BR.svg is
// the one of pt-BR.
const FLAGS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<{ default: string }>('@/assets/locales/*.svg', {
      eager: true,
    }),
  ).flatMap(([path, module]) => {
    const code = /([a-z]{2}(?:-[A-Z]{2})?)\.svg$/.exec(path)?.[1];

    return code ? [[code, module.default]] : [];
  }),
);

/** The flag shown next to a language. */
export const flagOf = (code: string) => FLAGS[code];

/** A language by its own name, such as "Português (Brasil)". */
export function languageName(code: string) {
  try {
    const name =
      new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;

    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return code;
  }
}

/** Switches the app to a language, kept for the next launch. */
export function chooseLanguage(locale: Ref<string>, code: string) {
  locale.value = code;
  defaultLocale.value = code;
}
