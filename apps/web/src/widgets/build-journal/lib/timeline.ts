import type { InterventionEvent, MessageEvent, PromptEvent, SessionEvent } from "@cyberzavod/core";
import { interventionAnchor, labelOf } from "@/entities/intervention";
import { messageAnchor, routeOf } from "@/entities/message";
import { recipientOf } from "@/entities/prompt";
import type { Speech } from "@/features/journal-sync";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatClock } from "@/shared/lib/format.ts";

/** Запись журнала сборки: промпт, вмешательство или реплика с номером речи, как в цехе. */
export type TimelineEntry =
  | { kind: "prompt"; prompt: PromptEvent; speech: Extract<Speech, { kind: "prompt" }> }
  | {
      kind: "intervention";
      intervention: InterventionEvent;
      speech: Extract<Speech, { kind: "intervention" }>;
    }
  | { kind: "message"; message: MessageEvent; speech: Extract<Speech, { kind: "message" }> };

/** Шапка записи журнала: якорь для «подробнее», время в сборке и маршрут. */
export interface EntryHeader {
  /** id элемента журнала; у промпта его нет — к нему не ведёт «подробнее». */
  readonly anchor: string | undefined;
  /** Время записи в сборке, например `1:30`. */
  readonly clock: string;
  /** От кого и кому или метка вмешательства. */
  readonly route: string;
}

/**
 * Собирает журнал сборки из событий записи: промпты, вмешательства и реплики одним списком по
 * времени. Номера — те же, что у пузырей в цехе: по ним цех и журнал находят друг друга, а по
 * номеру вмешательства или реплики «подробнее» находит запись.
 * @param {readonly SessionEvent[]} events События записи.
 * @returns {TimelineEntry[]} Записи журнала в порядке событий.
 */
export function timelineOf(events: readonly SessionEvent[]): TimelineEntry[] {
  let promptIndex = 0;
  let interventionIndex = 0;
  let messageIndex = 0;

  return events.flatMap((event): TimelineEntry[] => {
    switch (event.type) {
      case "prompt":
        return [
          { kind: "prompt", prompt: event, speech: { kind: "prompt", index: promptIndex++ } },
        ];
      case "intervention":
        return [
          {
            kind: "intervention",
            intervention: event,
            speech: { kind: "intervention", index: interventionIndex++ },
          },
        ];
      case "message":
        return [
          { kind: "message", message: event, speech: { kind: "message", index: messageIndex++ } },
        ];
      case "build_start":
      case "stage_enter":
      case "stage_fail":
      case "usage":
      case "build_end":
        return [];
      default:
        // Новый тип события не скомпилируется, пока здесь не решат, попадает ли он в журнал.
        return event satisfies never;
    }
  });
}

/**
 * Шапка записи журнала на языке страницы.
 * @param {TimelineEntry} entry Запись журнала.
 * @param {Locale} locale Язык страницы.
 * @returns {EntryHeader} Якорь, время и маршрут.
 */
export function headerOf(entry: TimelineEntry, locale: Locale): EntryHeader {
  switch (entry.kind) {
    case "prompt":
      return {
        anchor: undefined,
        clock: formatClock(entry.prompt.t),
        route: UI_TEXT.speech.humanTo[locale](recipientOf(entry.prompt, locale)),
      };
    case "intervention":
      return {
        anchor: interventionAnchor(entry.speech.index),
        clock: formatClock(entry.intervention.t),
        route: labelOf(entry.intervention, locale),
      };
    case "message":
      return {
        anchor: messageAnchor(entry.speech.index),
        clock: formatClock(entry.message.t),
        route: routeOf(entry.message, locale),
      };
    default:
      return entry satisfies never;
  }
}
