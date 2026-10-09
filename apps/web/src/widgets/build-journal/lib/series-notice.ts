import type { SessionRecord } from "@cyberzavod/core";
import type { Remote } from "@/shared/api/remote.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";

/**
 * Series journal message while the full build recording cannot be shown: it is loading, was not
 * found, is broken, or failed to load.
 * @param {Remote<SessionRecord>} state State of the full recording.
 * @param {Locale} locale Page language.
 * @returns {string | undefined} Message text, or `undefined` if the recording is ready.
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
