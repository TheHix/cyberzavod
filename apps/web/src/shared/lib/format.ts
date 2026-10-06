// Форматирование чисел, времени и дат для страниц записей и счётчиков над цехом. Язык приходит
// параметром: страницы собираются заранее, и язык зрителя им неизвестен.

import { byLocale, LOCALE_TAGS, type Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";

const SECOND_MS = 1000;
const MINUTE_SECONDS = 60;
const HOUR_MINUTES = 60;

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Форматирует длительность для счётчика: секунды, минуты с секундами или часы с минутами.
 * @param {number} ms Длительность в миллисекундах.
 * @param {Locale} locale Язык подписей единиц.
 * @returns {string} Строка вида «42 с», «2 мин 05 с» или «1 ч 05 мин»; по-английски «42 s», «2 min 05 s», «1 h 05 min».
 */
export function formatDuration(ms: number, locale: Locale): string {
  const { hour, minute, second } = UI_TEXT.duration;
  const totalSeconds = Math.round(ms / SECOND_MS);
  const totalMinutes = Math.floor(totalSeconds / MINUTE_SECONDS);
  const hours = Math.floor(totalMinutes / HOUR_MINUTES);
  if (hours > 0) {
    return `${hours} ${hour[locale]} ${twoDigits(totalMinutes % HOUR_MINUTES)} ${minute[locale]}`;
  }
  if (totalMinutes > 0) {
    return `${totalMinutes} ${minute[locale]} ${twoDigits(totalSeconds % MINUTE_SECONDS)} ${second[locale]}`;
  }
  return `${totalSeconds} ${second[locale]}`;
}

/**
 * Форматирует момент сборки от её начала, как время на шкале проигрывателя.
 * @param {number} ms Миллисекунды от начала сборки.
 * @returns {string} Строка вида «2:05» или «1:02:05».
 */
export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / SECOND_MS);
  const totalMinutes = Math.floor(totalSeconds / MINUTE_SECONDS);
  const hours = Math.floor(totalMinutes / HOUR_MINUTES);
  const seconds = twoDigits(totalSeconds % MINUTE_SECONDS);
  if (hours === 0) return `${totalMinutes}:${seconds}`;
  return `${hours}:${twoDigits(totalMinutes % HOUR_MINUTES)}:${seconds}`;
}

const TOKEN_FORMATTERS = byLocale((locale) => new Intl.NumberFormat(LOCALE_TAGS[locale]));

/**
 * Форматирует число токенов с разбиением по разрядам.
 * @param {number} tokens Число токенов.
 * @param {Locale} locale Язык, по правилам которого разбиваются разряды.
 * @returns {string} Строка вида «1 234 567»; по-английски «1,234,567».
 */
export function formatTokens(tokens: number, locale: Locale): string {
  return TOKEN_FORMATTERS[locale].format(tokens);
}

// Страницы собираются заранее, без часового пояса зрителя, поэтому день — по UTC, как и в id записи.
const DATE_FORMATTERS = byLocale(
  (locale) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
);

/**
 * Форматирует день начала записи для подписи.
 * @param {string} startedAt Время в ISO 8601: `2026-10-04T09:52:13.000Z`.
 * @param {Locale} locale Язык названия месяца и порядка частей даты.
 * @returns {string} Строка вида «4 октября 2026 г.»; по-английски «October 4, 2026».
 */
export function formatDate(startedAt: string, locale: Locale): string {
  return DATE_FORMATTERS[locale].format(new Date(startedAt));
}

// id модели Claude: `claude-opus-5-5`; у старых — с датой выпуска, иногда без младшей версии:
// `claude-haiku-4-5-20251001`, `claude-sonnet-4-20250514`.
const CLAUDE_MODEL_ID = /^claude-([a-z]+)-(\d{1,2})(?:-(\d{1,2}))?(?:-\d{8})?$/;

/**
 * Превращает id модели в название для подписи; незнакомый id показывается как есть.
 * @param {string} id Идентификатор модели: `claude-opus-5-5`.
 * @returns {string} Название вида «Claude Opus 5.5» или «Claude Sonnet 4».
 */
export function formatModel(id: string): string {
  const [, family, major, minor] = CLAUDE_MODEL_ID.exec(id) ?? [];
  if (family === undefined || major === undefined) return id;
  const version = minor === undefined ? major : `${major}.${minor}`;
  return `Claude ${family.charAt(0).toUpperCase()}${family.slice(1)} ${version}`;
}

/** Формы слова для числа на каждом языке: русский различает три формы, английский две. */
export interface PluralWords {
  /** «1 промпт», «2 промпта», «5 промптов». */
  readonly ru: { readonly one: string; readonly few: string; readonly many: string };
  /** «1 prompt», «2 prompts». */
  readonly en: { readonly one: string; readonly other: string };
}

const PLURAL_RULES = byLocale((locale) => new Intl.PluralRules(LOCALE_TAGS[locale]));
const COUNT_FORMATTERS = byLocale((locale) => new Intl.NumberFormat(LOCALE_TAGS[locale]));

function wordFor(count: number, words: PluralWords, locale: Locale): string {
  switch (locale) {
    case "ru": {
      const category = PLURAL_RULES.ru.select(count);
      return category === "one" ? words.ru.one : category === "few" ? words.ru.few : words.ru.many;
    }
    case "en":
      return PLURAL_RULES.en.select(count) === "one" ? words.en.one : words.en.other;
    default:
      // Новый язык не скомпилируется, пока для него не опишут формы слова.
      return locale satisfies never;
  }
}

/**
 * Пишет число со словом в нужной форме.
 * @param {number} count Целое число.
 * @param {PluralWords} words Формы слова на каждом языке.
 * @param {Locale} locale Язык, по правилам которого выбирается форма и пишется число.
 * @returns {string} Строка вида «5 промптов» или «2 875 954 токена»; по-английски «1 prompt», «2 prompts».
 */
export function formatCount(count: number, words: PluralWords, locale: Locale): string {
  return `${COUNT_FORMATTERS[locale].format(count)} ${wordFor(count, words, locale)}`;
}
