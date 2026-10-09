import type { Locale, Translated } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import type { Remote } from "./remote.ts";

/**
 * The message shown in place of API data while it cannot be shown: shared loading and error
 * texts, and the page's own text for "no data".
 * @param {Remote<unknown>} state Data state.
 * @param {Translated} missing Text for a 404 response in each language.
 * @param {Locale} locale Page language.
 * @returns {string | undefined} Message text, or `undefined` if the data is ready.
 */
export function remoteNoticeOf(
  state: Remote<unknown>,
  missing: Translated,
  locale: Locale,
): string | undefined {
  switch (state.status) {
    case "ready":
      return undefined;
    case "loading":
      return UI_TEXT.remote.loading[locale];
    case "missing":
      return missing[locale];
    case "broken":
      return UI_TEXT.remote.broken[locale];
    case "failed":
      return UI_TEXT.remote.failed[locale];
    default:
      return state satisfies never;
  }
}
