import type { Locale } from "@/shared/i18n/locale.ts";
import { formatNumber } from "@/shared/lib/format.ts";
import type { BarItem } from "@/shared/ui";

/**
 * Analytics chart row with a number: a bar by the number, and next to it the number formatted for
 * the page language.
 * @param {string} label Row label: stage, reason or outcome.
 * @param {number} count Row counter: how many times it happened.
 * @param {Locale} locale Page language.
 * @returns {BarItem} Chart row.
 */
export function barOf(label: string, count: number, locale: Locale): BarItem {
  return { label, value: count, valueText: formatNumber(count, locale) };
}
