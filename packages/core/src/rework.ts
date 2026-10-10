// Reworks of a session: the moments a stage sent the work back, with what the stage said when it
// did. `stage_fail.reason` is only a generic reason; the substance is the message before it.

import type { MessageEvent, SessionEvent, SessionRecord } from "./record.ts";
import type { Stage } from "./stage.ts";

/** A rework: a stage sent the work back. */
export interface Rework {
  /** Moment of the `stage_fail`, milliseconds from the session start. */
  readonly t: number;
  /** The stage that sent the work back. */
  readonly stage: Stage;
  /** `stage_fail.reason`: generic, shown when the stage said nothing before returning. */
  readonly reason: string;
  /** The last message the stage said before returning the work; absent if it said nothing. */
  readonly message: MessageEvent | undefined;
}

type StageFailEvent = Extract<SessionEvent, { type: "stage_fail" }>;

// The search for the stage's words ends where this stage's current pass began: its entry or the
// previous return, so a message from an earlier pass is not taken for this one.
function isPassStartOf(event: SessionEvent, stage: Stage): boolean {
  return (event.type === "stage_enter" || event.type === "stage_fail") && event.stage === stage;
}

function messageBeforeReturn(
  events: readonly SessionEvent[],
  failIndex: number,
  stage: Stage,
): MessageEvent | undefined {
  for (let index = failIndex - 1; index >= 0; index--) {
    const event = events[index];

    if (event === undefined || isPassStartOf(event, stage)) return undefined;
    if (event.type === "message" && event.from === stage) return event;
  }

  return undefined;
}

function reworkOf(events: readonly SessionEvent[], fail: StageFailEvent, index: number): Rework {
  return {
    t: fail.t,
    stage: fail.stage,
    reason: fail.reason,
    message: messageBeforeReturn(events, index, fail.stage),
  };
}

/**
 * Derives the session reworks: one per `stage_fail`, in event order, each with the last message
 * the returning stage said since it entered (or since its previous return). The single place that
 * knows how a rework and what was said at it are tied together.
 * @param {SessionRecord} session The validated session.
 * @returns {Rework[]} Reworks in event order; empty if no stage sent the work back.
 */
export function reworksOf(session: SessionRecord): Rework[] {
  const { events } = session.data;

  return events.flatMap((event, index) =>
    event.type === "stage_fail" ? [reworkOf(events, event, index)] : [],
  );
}
