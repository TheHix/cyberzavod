// Языки сайта. Файл без импортов с алиасами: его читает и `astro.config.ts`.

/** Языки сайта: по ним собираются маршруты, словарь интерфейса и карта сайта. */
export const LOCALES = ["en", "ru"] as const;

/** Язык сайта: член `LOCALES`. */
export type Locale = (typeof LOCALES)[number];

/** Язык по умолчанию: его страницы лежат в корне сайта, без префикса. */
export const DEFAULT_LOCALE: Locale = "en";

/** Значение на каждом языке: пропущенный язык не компилируется. */
export type Translated<T = string> = Readonly<Record<Locale, T>>;

/** Теги BCP 47 для `Intl`: числа и даты форматируются правилами языка страницы, а не зрителя. */
export const LOCALE_TAGS: Translated = { en: "en-US", ru: "ru-RU" };

/** Самоназвания языков: подпись переключателя понятна тому, кто не читает страницу. */
export const LOCALE_NAMES: Translated = { en: "English", ru: "Русский" };

/**
 * Язык содержимого, которое пока существует только в оригинале: гайды и карточки проектов.
 * Интерфейс вокруг переводится, содержимое помечается этим языком через `lang`.
 */
export const CONTENT_LOCALE: Locale = "ru";

/**
 * Остальные языки сайта: куда может вести переключатель.
 * @param {Locale} locale Язык текущей страницы.
 * @returns {readonly Locale[]} Все языки, кроме этого, в порядке `LOCALES`.
 */
export function otherLocales(locale: Locale): readonly Locale[] {
  return LOCALES.filter((candidate) => candidate !== locale);
}

/**
 * Строит значение для каждого языка одной функцией, например форматтер `Intl` по тегу языка.
 * @param {(locale: Locale) => T} make Строит значение для языка.
 * @returns {Translated<T>} Значения всех языков.
 */
export function byLocale<T>(make: (locale: Locale) => T): Translated<T> {
  return { en: make("en"), ru: make("ru") };
}
