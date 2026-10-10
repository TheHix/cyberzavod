// Models of the stages: which models ran each stage the session entered. The agent is not here: a
// project is led by one agent, so the agent of every stage is the record's `source`.

import type { BriefSessionEvent, BriefSessionRecord, StageEnterEvent } from "./record.ts";
import { STAGES, type Stage } from "./stage.ts";

/** Models that ran one stage of a session. */
export interface StageModels {
  readonly stage: Stage;
  /** Model ids in the order of the stage entries, without repeats; empty if no entry named one. */
  readonly models: readonly string[];
}

function enteredStage(event: BriefSessionEvent, stage: Stage): event is StageEnterEvent {
  return event.type === "stage_enter" && event.stage === stage;
}

function modelsOfStage(session: BriefSessionRecord, stage: Stage): string[] | undefined {
  const entries = session.data.events.filter((event) => enteredStage(event, stage));

  if (entries.length === 0) return undefined;

  const named = entries.flatMap((entry) => (entry.model === undefined ? [] : [entry.model]));

  return [...new Set(named)];
}

/**
 * Derives the models that ran each stage of the session: a stage is entered several times when the
 * work is sent back, and a rework may go to another model. The single place that knows how the
 * models of a stage are put together.
 * @param {BriefSessionRecord} session The validated session.
 * @returns {StageModels[]} Entered stages in the order of `STAGES`; stages never entered are absent.
 */
export function stageModelsOf(session: BriefSessionRecord): StageModels[] {
  return STAGES.flatMap((stage) => {
    const models = modelsOfStage(session, stage);

    return models === undefined ? [] : [{ stage, models }];
  });
}
