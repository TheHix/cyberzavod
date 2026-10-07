// Фабрики черновиков для тестов: сессия с двумя задачами в разных проектах по образцу реальной,
// где запуски станций идут вперемешку, а между ними человек молчит.

import type { Draft, DraftEvent, DraftIntervention, DraftMessage } from "./draft.ts";

/** Идентификатор первой сборки черновика `interleavedDraft` — он же `id` самого черновика. */
export const FIRST_BUILD_ID = "2026-10-04-744e7547";

/** Идентификатор второй сборки черновика `interleavedDraft`. */
export const SECOND_BUILD_ID = "2026-10-04-744e7547-2";

/**
 * Реплика черновика с заполненными строкой и текстом; пустую делают поправкой `line` и `text`.
 * @param {Partial<DraftMessage> & Pick<DraftMessage, "t">} patch Поля реплики, которые отличаются
 *   от обычных; время обязательно.
 * @returns {DraftMessage} Новая реплика.
 */
export function message(patch: Partial<DraftMessage> & Pick<DraftMessage, "t">): DraftMessage {
  return {
    type: "draft_message",
    from: "planning",
    to: "foreman",
    source: "assignment",
    said: "Исходный текст",
    line: "Принял, берусь",
    text: "Принял задание и берусь за него.",
    ...patch,
  };
}

/**
 * Вмешательство черновика с заполненными строкой и текстом; пустое делают поправкой `line`
 * и `text`.
 * @param {Partial<DraftIntervention> & Pick<DraftIntervention, "t">} patch Поля вмешательства,
 *   которые отличаются от обычных; время обязательно.
 * @returns {DraftIntervention} Новое вмешательство.
 */
export function intervention(
  patch: Partial<DraftIntervention> & Pick<DraftIntervention, "t">,
): DraftIntervention {
  return {
    type: "draft_intervention",
    reason: "plan_review",
    said: "ну давай, одобряю",
    line: "Одобряю, делай по плану",
    text: "Одобряю постановку, делай по плану.",
    ...patch,
  };
}

function window(
  t: number,
  run: string,
  agent: string,
  until: number,
  stage: "planning" | "implementation" | "verification",
): DraftEvent[] {
  return [
    { t, type: "stage_enter", stage, run },
    { t, type: "draft_run", run, agent, until },
  ];
}

/**
 * Черновик двух задач из одной сессии: «Счётчик токенов» в `cyberzavod` и «Движок финансов»
 * в `personal-finance-lab`. Запуски станций идут вперемешку: постановка первой задачи
 * работает, пока стартует вторая. У первой задачи возврат по тестам и пауза ожидания
 * дольше `IDLE_GAP_MS`, у второй проверки пройдены. Токены: 822 у первой, 370 у второй.
 * @returns {Draft} Свежий черновик с заполненной редактурой; его можно менять.
 */
export function interleavedDraft(): Draft {
  return {
    id: FIRST_BUILD_ID,
    startedAt: "2026-10-04T09:52:13.000Z",
    builds: [
      {
        id: FIRST_BUILD_ID,
        project: "cyberzavod",
        harness: "0.1.0",
        workflow: "default",
        title: "Счётчик токенов",
        language: "ru",
        runs: ["a1", "a2", "a3"],
      },
      {
        id: SECOND_BUILD_ID,
        project: "personal-finance-lab",
        harness: "0.1.0",
        workflow: "default",
        title: "Движок финансов",
        language: "ru",
        runs: ["b1", "b2"],
      },
    ],
    events: [
      { t: 0, type: "usage", tokens: 10 },
      {
        t: 0,
        type: "draft_prompt",
        said: "добавь плз счетчик токенов над цехом",
        goal: "Добавь счётчик токенов",
        requirements: [],
        model: "claude-opus-5-5",
      },
      { t: 0, type: "usage", tokens: 5 },
      ...window(1_000, "a1", "analyst", 31_000, "planning"),
      message({ t: 1_500, run: "a1" }),
      {
        t: 2_000,
        type: "draft_prompt",
        said: "а теперь движок финансов",
        goal: "Сделай движок финансов",
        requirements: ["Покрой его тестами"],
        build: SECOND_BUILD_ID,
      },
      { t: 2_000, type: "usage", tokens: 20 },
      ...window(3_000, "b1", "coder", 20_000, "implementation"),
      message({ t: 3_500, run: "b1", from: "implementation" }),
      { t: 20_000, type: "usage", tokens: 200, run: "b1" },
      ...window(21_000, "b2", "tester", 60_000, "verification"),
      { t: 31_000, type: "usage", tokens: 300, run: "a1" },
      message({ t: 31_000, run: "a1", source: "report" }),
      { t: 31_500, type: "usage", tokens: 7 },
      { t: 60_000, type: "usage", tokens: 150, run: "b2" },
      { t: 60_000, type: "draft_check", ok: true, run: "b2" },
      message({ t: 60_000, run: "b2", from: "verification", source: "report" }),
      ...window(200_000, "a2", "coder", 230_000, "implementation"),
      { t: 230_000, type: "usage", tokens: 400, run: "a2" },
      ...window(231_000, "a3", "tester", 250_000, "verification"),
      { t: 250_000, type: "draft_check", ok: false, run: "a3" },
      {
        t: 250_000,
        type: "stage_fail",
        stage: "verification",
        reason: "тестировщик нашёл дефект",
        run: "a3",
      },
      { t: 250_000, type: "usage", tokens: 100, run: "a3" },
      message({ t: 250_000, run: "a3", from: "verification", source: "report" }),
    ],
  };
}
