// Site languages. The file has no aliased imports: `astro.config.ts` reads it too.

/** Site languages: routes, the interface dictionary and the sitemap are built from them. */
export const LOCALES = ["en", "ru"] as const;

/** A site language: a member of `LOCALES`. */
export type Locale = (typeof LOCALES)[number];

/** Default language: its pages live at the site root, without a prefix. */
export const DEFAULT_LOCALE: Locale = "en";

/** A value in each language: a missing language does not compile. */
export type Translated<T = string> = Readonly<Record<Locale, T>>;

/** BCP 47 tags for `Intl`: numbers and dates follow the page language's rules, not the viewer's. */
export const LOCALE_TAGS: Translated = { en: "en-US", ru: "ru-RU" };

/** Language self-names: the switcher label is clear to someone who cannot read the page. */
export const LOCALE_NAMES: Translated = { en: "English", ru: "Русский" };

/**
 * Checks that an outside string is a site language code.
 * @param {string} value String, for example part of a file name.
 * @returns {boolean} `true` if it is a member of `LOCALES`.
 */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * The other site languages: where the switcher can lead.
 * @param {Locale} locale Language of the current page.
 * @returns {readonly Locale[]} All languages except this one, in `LOCALES` order.
 */
export function otherLocales(locale: Locale): readonly Locale[] {
  return LOCALES.filter((candidate) => candidate !== locale);
}

/**
 * Builds a value for each language with one function, for example an `Intl` formatter by tag.
 * @param {(locale: Locale) => T} make Builds the value for a language.
 * @returns {Translated<T>} Values for all languages.
 */
export function byLocale<T>(make: (locale: Locale) => T): Translated<T> {
  return { en: make("en"), ru: make("ru") };
}
