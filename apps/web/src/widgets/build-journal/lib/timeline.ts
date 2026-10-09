import type { InterventionEvent, MessageEvent, PromptEvent, SessionEvent } from "@cyberzavod/core";
import { interventionAnchor, labelOf } from "@/entities/intervention";
import { messageAnchor, routeOf } from "@/entities/message";
import { recipientOf } from "@/entities/prompt";
import type { Speech } from "@/features/journal-sync";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatClock } from "@/shared/lib/format.ts";

/**
 * Build journal entry: a prompt, an intervention or a message with a speech number, as on the
 * floor.
 */
export type TimelineEntry =
  | { kind: "prompt"; prompt: PromptEvent; speech: Extract<Speech, { kind: "prompt" }> }
  | {
      kind: "intervention";
      intervention: InterventionEvent;
      speech: Extract<Speech, { kind: "intervention" }>;
    }
  | { kind: "message"; message: MessageEvent; speech: Extract<Speech, { kind: "message" }> };

/** Journal entry header: the anchor for "more", the time in the build and the route. */
export interface EntryHeader {
  /** Journal element id; a prompt has none, since no "more" leads to it. */
  readonly anchor: string | undefined;
  /** Entry time in the build, e.g. `1:30`. */
  readonly clock: string;
  /** From whom to whom, or the intervention label. */
  readonly route: string;
}

/**
 * Builds the build journal from the recording events: prompts, interventions and messages in one
 * list by time. The numbers are the same as on the floor bubbles: by them the floor and the
 * journal find each other, and "more" finds the entry by the intervention or message number.
 * @param {readonly SessionEvent[]} events Recording events.
 * @returns {TimelineEntry[]} Journal entries in event order.
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
        // A new event type will not compile until it is decided here whether it enters the journal.
        return event satisfies never;
    }
  });
}

/**
 * Journal entry header in the page language.
 * @param {TimelineEntry} entry Journal entry.
 * @param {Locale} locale Page language.
 * @returns {EntryHeader} Anchor, time and route.
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
