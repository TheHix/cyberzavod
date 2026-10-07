import type { Locale, Translated } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import type { Remote } from "./remote.ts";

/**
 * Сообщение на месте данных из API, пока их нельзя показать: общие тексты загрузки и ошибок, а
 * для «нет данных» — свой текст страницы.
 * @param {Remote<unknown>} state Состояние данных.
 * @param {Translated} missing Текст для ответа 404 на каждом языке.
 * @param {Locale} locale Язык страницы.
 * @returns {string | undefined} Текст сообщения или `undefined`, если данные готовы.
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
