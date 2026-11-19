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

/** A country by its name in `locale`, or by its code when it has none. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * A language by its name in `locale`, starting with a capital as in a
 * list ("Coreano"), or by its code when it has none.
 */
export function languageIn(code: string, locale: string): string {
  let name = code;

  try {
    name =
      new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    // The code, then.
  }

  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}
