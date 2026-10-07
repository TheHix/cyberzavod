import type { SharedRecording } from "@/entities/gallery";
import type { Remote } from "@/shared/api/remote.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";

/**
 * Сообщение на месте записи из галереи, пока её нельзя показать: грузится, не найдена, битая
 * или не загрузилась.
 * @param {Remote<SharedRecording>} state Состояние записи.
 * @param {Locale} locale Язык страницы.
 * @returns {string | undefined} Текст сообщения или `undefined`, если запись готова.
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
