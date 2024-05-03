export class LanguageItem {
    private availableLocales: string[];
    private locale: object;
  
    constructor(availableLocales: string[], locale: object) {
      this.availableLocales = availableLocales;
      this.locale = locale;
    }

    private getLocales(): {}{
        return this.availableLocales.map((lang) => {
            return {
                label: lang,
                command: () => this.toggleLocale(lang)
            };
        });
    }

    private toggleLocale(lang: string) {
        // @ts-expect-error Value will always exist
        this.locale.value = lang;
    }
  
    // Método que retorna o valor do atributo
    public getLanguages(): {} {
        return {
            icon: 'pi pi-language',
            items: this.getLocales()
        }
    }
};
