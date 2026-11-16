/** The country of each language of the app, when the system names none. */
const BY_LANGUAGE: Record<string, string> = {
  en: 'US',
  es: 'ES',
  'pt-BR': 'BR',
};

/**
 * Where the user is, as a country code such as `BR`, for what can be
 * watched there. It comes from the languages of the system or browser
 * (`pt-BR` is Brazil, `en-GB` the United Kingdom), and from the language of
 * the app when none of those names a country.
 */
export function userRegion(
  appLocale: string,
  languages: readonly string[] = navigator.languages,
): string {
  for (const tag of languages) {
    try {
      const { region } = new Intl.Locale(tag);

      // Leaves out regions that are not countries, such as 419.
      if (region && /^[A-Z]{2}$/.test(region)) {
        return region;
      }
    } catch {
      // not a language tag
    }
  }

  return BY_LANGUAGE[appLocale] ?? 'US';
}
