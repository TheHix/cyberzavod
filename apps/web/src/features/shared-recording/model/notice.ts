import type { SharedRecording } from "@/entities/gallery";
import type { Remote } from "@/shared/api/remote.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";

/**
 * Message in place of a gallery recording while it cannot be shown: loading, not found, broken
 * or failed to load.
 * @param {Remote<SharedRecording>} state Recording state.
 * @param {Locale} locale Page language.
 * @returns {string | undefined} Message text, or `undefined` if the recording is ready.
 */
export function noticeOf(state: Remote<SharedRecording>, locale: Locale): string | undefined {
  switch (state.status) {
    case "ready":
      return undefined;
    case "loading":
      return UI_TEXT.sharedRecording.loading[locale];
    case "missing":
      return UI_TEXT.sharedRecording.missing[locale];
    case "broken":
      return UI_TEXT.sharedRecording.broken[locale];
    case "failed":
      return UI_TEXT.sharedRecording.failed[locale];
    default:
      return state satisfies never;
  }
}
