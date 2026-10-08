import type { Locale } from "@/shared/i18n/locale.ts";
import { formatNumber } from "@/shared/lib/format.ts";
import type { BarItem } from "@/shared/ui";

/**
 * Строка диаграммы аналитики с числом: полоса по числу, рядом оно же по правилам языка страницы.
 * @param {string} label Подпись строки: этап, причина или исход.
 * @param {number} count Счётчик строки: сколько раз это было.
 * @param {Locale} locale Язык страницы.
 * @returns {BarItem} Строка диаграммы.
 */
export function barOf(label: string, count: number, locale: Locale): BarItem {
  return { label, value: count, valueText: formatNumber(count, locale) };
}
