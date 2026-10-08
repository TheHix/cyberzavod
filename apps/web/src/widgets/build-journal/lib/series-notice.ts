import type { SessionRecord } from "@cyberzavod/core";
import type { Remote } from "@/shared/api/remote.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";

/**
 * Сообщение в журнале серии, пока полную запись сборки нельзя показать: грузится, не нашлась,
 * битая или не загрузилась.
 * @param {Remote<SessionRecord>} state Состояние полной записи.
 * @param {Locale} locale Язык страницы.
 * @returns {string | undefined} Текст сообщения или `undefined`, если запись готова.
 */
export function seriesJournalNoticeOf(
  state: Remote<SessionRecord>,
  locale: Locale,
): string | undefined {
  switch (state.status) {
    case "ready":
      return undefined;
    case "loading":
      return UI_TEXT.series.journalLoading[locale];
    case "missing":
      return UI_TEXT.series.journalMissing[locale];
    case "broken":
      return UI_TEXT.series.journalBroken[locale];
    case "failed":
      return UI_TEXT.series.journalFailed[locale];
    default:
      return state satisfies never;
  }
}
