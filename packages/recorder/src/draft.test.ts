import { describe, expect, it } from "vitest";
import { RecordingError } from "@cyberzavod/core";
import {
  carryOverEdits,
  DraftError,
  orphanedEdits,
  parseDraft,
  publishDraft,
  type Draft,
} from "./draft.ts";

function editedDraft(): Draft {
  return {
    id: "2026-10-04-744e7547",
    startedAt: "2026-10-04T09:52:13.000Z",
    title: "Счётчик токенов",
    events: [
      { t: 0, type: "build_start" },
      {
        t: 1_000,
        type: "draft_prompt",
        said: "добавь плз счетчик токенов над цехом",
        goal: "Добавь счётчик токенов",
        requirements: ["Показывай его над цехом"],
        model: "claude-opus-5-5",
      },
      { t: 2_000, type: "stage_enter", stage: "code" },
      { t: 3_000, type: "build_end", ok: true },
    ],
  };
}

function uneditedDraft(): Draft {
  const draft = editedDraft();
  return {
    ...draft,
    title: "",
    events: draft.events.map((event) =>
      event.type === "draft_prompt" ? { ...event, goal: "", requirements: [] } : event,
    ),
  };
}

describe("parseDraft", () => {
  it("принимает черновик с ещё пустой редактурой", () => {
    const raw: unknown = JSON.parse(JSON.stringify(uneditedDraft()));

    const draft = parseDraft(raw);

    expect(draft).toEqual(uneditedDraft());
  });

  it("отклоняет промпт без исходного текста", () => {
    const raw = {
      ...editedDraft(),
      events: [{ t: 0, type: "draft_prompt", goal: "Цель", requirements: [] }],
    };

    const act = () => parseDraft(raw);

    expect(act).toThrow(DraftError);
  });

  it("отклоняет модель не строкой", () => {
    const raw = {
      ...editedDraft(),
      events: [{ t: 0, type: "draft_prompt", said: "текст", goal: "", requirements: [], model: 5 }],
    };

    const act = () => parseDraft(raw);

    expect(act).toThrow(/model/);
  });

  it("отклоняет событие цеха не по формату ядра", () => {
    const raw = { ...editedDraft(), events: [{ t: 0, type: "stage_enter", stage: "deploy" }] };

    const act = () => parseDraft(raw);

    expect(act).toThrow(RecordingError);
  });
});

describe("carryOverEdits", () => {
  it("переносит заголовок и редактуру промпта с тем же временем и текстом", () => {
    const previous = editedDraft();
    const next = uneditedDraft();

    const draft = carryOverEdits(previous, next);

    expect(draft).toEqual(editedDraft());
  });

  it("сохраняет найденную раньше модель, если транскрипта уже нет", () => {
    const previous = editedDraft();
    const next: Draft = {
      ...uneditedDraft(),
      events: [
        { t: 0, type: "build_start" },
        {
          t: 1_000,
          type: "draft_prompt",
          said: "добавь плз счетчик токенов над цехом",
          goal: "",
          requirements: [],
        },
        { t: 3_000, type: "build_end", ok: true },
      ],
    };

    const draft = carryOverEdits(previous, next);

    expect(draft.events[1]).toMatchObject({ model: "claude-opus-5-5" });
  });

  it("оставляет пустым новый промпт и промпт с другим текстом", () => {
    const previous = editedDraft();
    const next: Draft = {
      ...uneditedDraft(),
      events: [
        { t: 0, type: "build_start" },
        { t: 1_000, type: "draft_prompt", said: "другой текст", goal: "", requirements: [] },
        { t: 5_000, type: "draft_prompt", said: "новый промпт", goal: "", requirements: [] },
        { t: 6_000, type: "build_end", ok: true },
      ],
    };

    const draft = carryOverEdits(previous, next);

    expect(draft.events).toEqual(next.events);
  });
});

describe("orphanedEdits", () => {
  it("находит редактуру промпта, исходный текст которого поменялся", () => {
    const previous = editedDraft();
    const next: Draft = {
      ...uneditedDraft(),
      events: [
        { t: 0, type: "build_start" },
        { t: 1_000, type: "draft_prompt", said: "другой текст", goal: "", requirements: [] },
        { t: 3_000, type: "build_end", ok: true },
      ],
    };

    const orphaned = orphanedEdits(previous, next).map((prompt) => prompt.goal);

    expect(orphaned).toEqual(["Добавь счётчик токенов"]);
  });

  it("находит и редактуру, где заполнены только требования", () => {
    const previous = uneditedDraft();
    previous.events[1] = {
      t: 1_000,
      type: "draft_prompt",
      said: "добавь плз счетчик токенов над цехом",
      goal: "",
      requirements: ["Показывай его над цехом"],
    };
    const next: Draft = { ...uneditedDraft(), events: [] };

    const orphaned = orphanedEdits(previous, next).map((prompt) => prompt.requirements);

    expect(orphaned).toEqual([["Показывай его над цехом"]]);
  });

  it("не считает потерей промпт, который ещё не редактировали", () => {
    const previous = uneditedDraft();
    const next: Draft = { ...uneditedDraft(), events: [] };

    const orphaned = orphanedEdits(previous, next);

    expect(orphaned).toEqual([]);
  });
});

describe("publishDraft", () => {
  it("публикует промпты без исходного текста, но с моделью", () => {
    const draft = editedDraft();

    const recording = publishDraft(draft);

    expect(recording.events[1]).toEqual({
      t: 1_000,
      type: "prompt",
      goal: "Добавь счётчик токенов",
      requirements: ["Показывай его над цехом"],
      model: "claude-opus-5-5",
    });
  });

  it("не публикует черновик без чистовой версии промпта", () => {
    const draft = { ...uneditedDraft(), title: "Счётчик токенов" };

    const act = () => publishDraft(draft);

    expect(act).toThrow(/goal/);
  });

  it("не публикует черновик без заголовка", () => {
    const draft = { ...editedDraft(), title: "" };

    const act = () => publishDraft(draft);

    expect(act).toThrow(/title/);
  });

  it("проверяет на утечки и причину возврата на доработку", () => {
    const draft = editedDraft();
    draft.events[2] = {
      t: 2_000,
      type: "stage_fail",
      stage: "test",
      reason: "нет доступа к 203.0.113.7",
    };

    const act = () => publishDraft(draft);

    expect(act).toThrow(/IP-адрес/);
  });

  it("проверяет на утечки и модель промпта", () => {
    const draft = editedDraft();
    draft.events[1] = {
      t: 1_000,
      type: "draft_prompt",
      said: "текст",
      goal: "Добавь счётчик",
      requirements: [],
      model: "arn:aws:bedrock:203.0.113.7",
    };

    const act = () => publishDraft(draft);

    expect(act).toThrow(/IP-адрес/);
  });

  it("не публикует адрес сервера, попавший в чистовую версию", () => {
    const draft = editedDraft();
    draft.events[1] = {
      t: 1_000,
      type: "draft_prompt",
      said: "зайди на 203.0.113.7",
      goal: "Зайти на сервер 203.0.113.7",
      requirements: [],
    };

    const act = () => publishDraft(draft);

    expect(act).toThrow(/IP-адрес/);
  });
});
