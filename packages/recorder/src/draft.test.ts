import { describe, expect, it } from "vitest";
import { RecordingError } from "@cyberzavod/core";
import {
  carryOverEdits,
  DraftError,
  orphanedEdits,
  parseDraft,
  publishDraft,
  unfilledHeader,
  type Draft,
  type DraftMessage,
  type DraftPrompt,
  type EditableDraftEvent,
} from "./draft.ts";

function promptsOnly(edits: EditableDraftEvent[]) {
  return edits.flatMap((edit) => (edit.type === "draft_prompt" ? [edit] : []));
}

function messageDraft(patch: Partial<DraftMessage> = {}): DraftMessage {
  return {
    t: 1_500,
    type: "draft_message",
    from: "code",
    to: "foreman",
    source: "assignment",
    said: "Сделай счётчик токенов, показывай над цехом",
    line: "",
    text: "",
    ...patch,
  };
}

function draftWith(...events: Draft["events"]): Draft {
  return { ...uneditedDraft(), events: [{ t: 0, type: "build_start" }, ...events] };
}

function editedDraft(): Draft {
  return {
    id: "2026-10-04-744e7547",
    project: "cyberzavod",
    factory: "0.1.0",
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

  it("читает старый черновик без project и factory с пустыми строками", () => {
    const old: Record<string, unknown> = { ...uneditedDraft() };
    delete old.project;
    delete old.factory;

    const draft = parseDraft(old);

    expect(draft).toMatchObject({ project: "", factory: "" });
  });

  it.each(["project", "factory"] as const)("отклоняет %s не строкой", (field) => {
    const raw = { ...uneditedDraft(), [field]: 5 };

    const act = () => parseDraft(raw);

    expect(act).toThrow(new RegExp(field));
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

  it.each(["assignment", "report", "answer"] as const)(
    "принимает реплику с source %s",
    (source) => {
      const raw = { ...uneditedDraft(), events: [messageDraft({ source })] };

      const draft = parseDraft(raw);

      expect(draft.events).toEqual([messageDraft({ source })]);
    },
  );

  it("принимает реплику с ещё пустой редактурой и промпт с пометкой «склеен»", () => {
    const joined = {
      t: 2_000,
      type: "draft_prompt",
      said: "да",
      goal: "",
      requirements: [],
      joined: true,
    };
    const raw = { ...uneditedDraft(), events: [messageDraft(), joined] };

    const draft = parseDraft(raw);

    expect(draft.events).toEqual([messageDraft(), joined]);
  });

  it.each([
    ["неизвестный говорящий", { from: "human" }],
    ["неизвестный адресат", { to: "deploy" }],
    ["неизвестный source", { source: "question" }],
    ["без source", { source: undefined }],
    ["без исходного текста", { said: undefined }],
    ["строка не строкой", { line: 5 }],
  ])("отклоняет реплику: %s", (_name, patch) => {
    const raw = { ...uneditedDraft(), events: [{ ...messageDraft(), ...patch }] };

    const act = () => parseDraft(raw);

    expect(act).toThrow(DraftError);
  });

  it("отклоняет пометку «склеен» не булевым значением", () => {
    const event = { t: 0, type: "draft_prompt", said: "да", goal: "", requirements: [], joined: 1 };

    const act = () => parseDraft({ ...uneditedDraft(), events: [event] });

    expect(act).toThrow(/joined/);
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

  it("переносит заполненные редактором проект и версию завода", () => {
    const previous = { ...editedDraft(), project: "demo", factory: "0.2.0" };
    const next = { ...uneditedDraft(), project: "", factory: "" };

    const draft = carryOverEdits(previous, next);

    expect(draft).toMatchObject({ project: "demo", factory: "0.2.0" });
  });

  it("берёт проект и версию завода из журнала, если редактор их не заполнил", () => {
    const previous = { ...editedDraft(), project: "", factory: "" };
    const next = { ...uneditedDraft(), project: "cyberzavod", factory: "0.1.0" };

    const draft = carryOverEdits(previous, next);

    expect(draft).toMatchObject({ project: "cyberzavod", factory: "0.1.0" });
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

describe("carryOverEdits: реплики и склейка", () => {
  const edited = messageDraft({ line: "Сделай счётчик", text: "Сделай счётчик токенов." });

  it("переносит строку и текст реплики с тем же временем и исходным текстом", () => {
    const previous = draftWith(edited);
    const next = draftWith(messageDraft());

    const draft = carryOverEdits(previous, next);

    expect(draft.events[1]).toEqual(edited);
  });

  it("берёт маршрут и source из пересобранного черновика, а редактуру из прошлого", () => {
    const previous = draftWith(edited);
    const next = draftWith(messageDraft({ from: "test", to: "code", source: "report" }));

    const draft = carryOverEdits(previous, next);

    expect(draft.events[1]).toEqual({ ...edited, from: "test", to: "code", source: "report" });
  });

  it("оставляет пустой реплику с другим исходным текстом", () => {
    const previous = draftWith(edited);
    const next = draftWith(messageDraft({ said: "Другой текст" }));

    const draft = carryOverEdits(previous, next);

    expect(draft.events).toEqual(next.events);
  });

  it("не путает реплику с промптом того же времени и текста", () => {
    const previous = draftWith({
      t: 1_500,
      type: "draft_prompt",
      said: messageDraft().said,
      goal: "Цель",
      requirements: [],
    });
    const next = draftWith(messageDraft());

    const draft = carryOverEdits(previous, next);

    expect(draft.events).toEqual(next.events);
  });

  it("переносит пометку «склеен» у промпта без чистовой версии", () => {
    const joined: DraftPrompt = {
      t: 2_000,
      type: "draft_prompt",
      said: "да",
      goal: "",
      requirements: [],
    };
    const previous = draftWith({ ...joined, joined: true });
    const next = draftWith(joined);

    const draft = carryOverEdits(previous, next);

    expect(draft.events[1]).toMatchObject({ joined: true });
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

    const orphaned = promptsOnly(orphanedEdits(previous, next)).map((prompt) => prompt.goal);

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

    const orphaned = promptsOnly(orphanedEdits(previous, next)).map(
      (prompt) => prompt.requirements,
    );

    expect(orphaned).toEqual([["Показывай его над цехом"]]);
  });

  it("находит отредактированную реплику, исходный текст которой поменялся", () => {
    const previous = draftWith(messageDraft({ line: "Сделай счётчик", text: "Текст" }));
    const next = draftWith(messageDraft({ said: "Другой текст" }));

    const orphaned = orphanedEdits(previous, next);

    expect(orphaned).toEqual([messageDraft({ line: "Сделай счётчик", text: "Текст" })]);
  });

  it("находит промпт с пометкой «склеен», которого больше нет", () => {
    const previous = draftWith({
      t: 2_000,
      type: "draft_prompt",
      said: "да",
      goal: "",
      requirements: [],
      joined: true,
    });
    const next = draftWith();

    const orphaned = orphanedEdits(previous, next);

    expect(orphaned).toHaveLength(1);
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

  it("переносит проект и версию завода в запись", () => {
    const draft = editedDraft();

    const recording = publishDraft(draft);

    expect(recording).toMatchObject({ version: 2, project: "cyberzavod", factory: "0.1.0" });
  });

  it.each(["project", "factory"] as const)("не публикует черновик с пустым полем %s", (field) => {
    const draft = { ...editedDraft(), [field]: "" };

    const act = () => publishDraft(draft);

    expect(act).toThrow(RecordingError);
    expect(act).toThrow(new RegExp(field));
  });

  it("проверяет на утечки версию завода", () => {
    const draft = { ...editedDraft(), factory: "сервер 203.0.113.7" };

    const act = () => publishDraft(draft);

    expect(act).toThrow(DraftError);
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

  it("публикует реплику без исходного текста и source", () => {
    const draft = editedDraft();
    draft.events.splice(
      2,
      0,
      messageDraft({ t: 1_500, line: "Сделай счётчик", text: "Сделай счётчик токенов." }),
    );

    const recording = publishDraft(draft);

    expect(recording.events[2]).toEqual({
      t: 1_500,
      type: "message",
      from: "code",
      to: "foreman",
      line: "Сделай счётчик",
      text: "Сделай счётчик токенов.",
    });
  });

  it("не публикует черновик с непроставленной репликой", () => {
    const draft = editedDraft();
    draft.events.splice(2, 0, messageDraft());

    const act = () => publishDraft(draft);

    expect(act).toThrow(/line/);
  });

  it("пропускает склеенные промпты", () => {
    const draft = editedDraft();
    draft.events.splice(2, 0, {
      t: 1_800,
      type: "draft_prompt",
      said: "да",
      goal: "",
      requirements: [],
      joined: true,
    });

    const recording = publishDraft(draft);

    expect(recording.events.filter((event) => event.type === "prompt")).toHaveLength(1);
  });

  it("не публикует склеенный первый промпт", () => {
    const draft = editedDraft();
    draft.events.splice(1, 0, {
      t: 500,
      type: "draft_prompt",
      said: "да",
      goal: "",
      requirements: [],
      joined: true,
    });

    const act = () => publishDraft(draft);

    expect(act).toThrow(DraftError);
  });

  it.each([
    ["строке", { line: "Зайти на 203.0.113.7", text: "Текст" }],
    ["тексте", { line: "Зайти", text: "Зайди на 203.0.113.7" }],
  ])("не публикует адрес сервера в %s реплики", (_name, patch) => {
    const draft = editedDraft();
    draft.events.splice(2, 0, messageDraft(patch));

    const act = () => publishDraft(draft);

    expect(act).toThrow(/IP-адрес/);
  });
});

describe("unfilledHeader", () => {
  it("не называет ничего, если шапка заполнена", () => {
    const draft = editedDraft();

    const names = unfilledHeader(draft);

    expect(names).toEqual([]);
  });

  it("называет все пустые поля шапки по порядку", () => {
    const draft = { ...editedDraft(), title: "", project: "", factory: "" };

    const names = unfilledHeader(draft);

    expect(names).toEqual(["заголовок", "проект", "версия завода"]);
  });

  it("называет только пустые поля", () => {
    const draft = { ...editedDraft(), factory: "" };

    const names = unfilledHeader(draft);

    expect(names).toEqual(["версия завода"]);
  });
});
