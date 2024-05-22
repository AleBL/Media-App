import { theMovieDb } from '@/util/tmdb';
import { defaultLocale } from '@/plugins/i18n';

export class LanguageItem {
  private availableLocales: string[];
  private locale: object;
  private icons: {};

  constructor(availableLocales: string[], locale: object) {
    this.availableLocales = availableLocales;
    this.locale = locale;

    const regex = /(?<=\/)[a-z]{2}(-[A-Z]{2})?(?=\.svg)/g;

    this.icons = Object.entries(
      import.meta.glob<{ default: string }>('@/assets/locales/*.svg', {
        eager: true,
      })
    ).reduce((acc, [key, value]) => {
      const matchedKey = key.match(regex)?.join();
      return matchedKey !== undefined
        ? { ...acc, [key.match(regex)!.join()]: value.default }
        : acc;
    }, {});
  }

  private getImageURL(lang: string): string {
    return this.icons[lang];
  }

  private getLocales(): {} {
    return this.availableLocales.map((lang) => {
      return {
        label: lang,
        imageURL: this.getImageURL(lang),
        command: () => this.toggleLocale(lang),
      };
    });
  }

  public toggleLocale(lang: string) {
    // @ts-expect-error Value will always exist
    this.locale.value = lang;
    theMovieDb.common.language = lang;
    defaultLocale.value = lang;
  }

  public getLanguages(): {} {
    return {
      icon: 'pi pi-language',
      showBand: true,
      items: this.getLocales(),
    };
  }

  public getCurrentLocaleIcon(): string {
    // @ts-expect-error Value will always exist
    return this.getImageURL(this.locale.value);
  }
}
