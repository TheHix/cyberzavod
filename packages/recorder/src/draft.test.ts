import { describe, expect, it } from "vitest";
import { RecordingError } from "@cyberzavod/core";
import {
  carryOverEdits,
  DraftError,
  orphanedEdits,
  orphanedRuns,
  parseDraft,
  publishBuild,
  publishDraft,
  reroutedMessages,
  unfilledHeader,
  type Draft,
  type DraftBuild,
  type DraftMessage,
  type DraftPrompt,
  type EditableDraftEvent,
} from "./draft.ts";
import { IDLE_GAP_MS } from "./builds.ts";
import { FIRST_BUILD_ID, interleavedDraft, SECOND_BUILD_ID } from "./draft.fixtures.ts";

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

const BUILD_ID = "2026-10-04-744e7547";

function draftWith(...events: Draft["events"]): Draft {
  return { ...uneditedDraft(), events };
}

function editedDraft(): Draft {
  return {
    id: BUILD_ID,
    startedAt: "2026-10-04T09:52:13.000Z",
    builds: [
      {
        id: BUILD_ID,
        project: "cyberzavod",
        factory: "0.1.0",
        title: "Счётчик токенов",
        runs: [],
      },
    ],
    events: [
      {
        t: 1_000,
        type: "draft_prompt",
        said: "добавь плз счетчик токенов над цехом",
        goal: "Добавь счётчик токенов",
        requirements: ["Показывай его над цехом"],
        model: "claude-opus-5-5",
      },
      { t: 2_000, type: "stage_enter", stage: "code" },
    ],
  };
}

function uneditedDraft(): Draft {
  const draft = editedDraft();
  return {
    ...draft,
    builds: draft.builds.map((build) => ({ ...build, title: "" })),
    events: draft.events.map((event) =>
      event.type === "draft_prompt" ? { ...event, goal: "", requirements: [] } : event,
    ),
  };
}

// Черновик прошлого формата: шапка одной сборки лежит прямо в корне.
function legacyDraft(): Record<string, unknown> {
  const { id, startedAt, events } = editedDraft();
  return {
    id,
    startedAt,
    project: "cyberzavod",
    factory: "0.1.0",
    title: "Счётчик токенов",
    events: [{ t: 0, type: "build_start" }, ...events, { t: 3_000, type: "build_end", ok: true }],
  };
}

function buildOf(draft: Draft, index: number): DraftBuild {
  const build = draft.builds[index];
  if (build === undefined) throw new Error(`в черновике нет сборки #${index}`);
  return build;
}

function publishOnly(draft: Draft) {
  return publishBuild(draft, BUILD_ID);
}

describe("parseDraft", () => {
  it("принимает черновик с ещё пустой редактурой", () => {
    const raw: unknown = JSON.parse(JSON.stringify(uneditedDraft()));

    const draft = parseDraft(raw);

    expect(draft).toEqual(uneditedDraft());
  });

  it("читает старый черновик без builds как одну сборку с id черновика", () => {
    const old = legacyDraft();

    const draft = parseDraft(old);

    expect(draft.builds).toEqual([
      {
        id: BUILD_ID,
        project: "cyberzavod",
        factory: "0.1.0",
        title: "Счётчик токенов",
        runs: [],
      },
    ]);
  });

  it("читает старый черновик без project и factory с пустыми строками", () => {
    const old = legacyDraft();
    delete old.project;
    delete old.factory;

    const draft = parseDraft(old);

    expect(draft.builds[0]).toMatchObject({ project: "", factory: "" });
  });

  it("публикует старый черновик одной записью с id черновика", () => {
    const draft = parseDraft(legacyDraft());

    const recordings = publishDraft(draft);

    expect(recordings.map((recording) => recording.id)).toEqual([BUILD_ID]);
  });

  it.each(["project", "factory"] as const)("отклоняет %s сборки не строкой", (field) => {
    const raw = { ...uneditedDraft(), builds: [{ ...uneditedDraft().builds[0], [field]: 5 }] };

    const act = () => parseDraft(raw);

    expect(act).toThrow(new RegExp(field));
  });

  it.each(["project", "factory"] as const)("отклоняет %s старого черновика не строкой", (field) => {
    const raw = { ...legacyDraft(), [field]: 5 };

    const act = () => parseDraft(raw);

    expect(act).toThrow(new RegExp(field));
  });

  it("отклоняет черновик без сборок", () => {
    const raw = { ...uneditedDraft(), builds: [] };

    const act = () => parseDraft(raw);

    expect(act).toThrow(/хотя бы одна сборка/);
  });

  it("отклоняет id сборки, который не подходит в имя файла", () => {
    const raw = { ...uneditedDraft(), builds: [{ ...uneditedDraft().builds[0], id: "../x" }] };

    const act = () => parseDraft(raw);

    expect(act).toThrow(DraftError);
  });

  it("отклоняет повторяющийся id сборки", () => {
    const [first] = uneditedDraft().builds;
    const raw = { ...uneditedDraft(), builds: [first, { ...first, runs: ["a1"] }] };

    const act = () => parseDraft(raw);

    expect(act).toThrow(/дважды/);
  });

  it("отклоняет запуск, указанный в двух сборках", () => {
    const [first] = uneditedDraft().builds;
    const raw = {
      ...uneditedDraft(),
      builds: [
        { ...first, runs: ["a1"] },
        { ...first, id: "second", runs: ["a1"] },
      ],
    };

    const act = () => parseDraft(raw);

    expect(act).toThrow(/a1.*двух сборках/);
  });

  it("отклоняет runs не списком строк", () => {
    const raw = { ...uneditedDraft(), builds: [{ ...uneditedDraft().builds[0], runs: [5] }] };

    const act = () => parseDraft(raw);

    expect(act).toThrow(/runs/);
  });

  it.each([
    ["промпт", { t: 1, type: "draft_prompt", said: "а", goal: "", requirements: [] }],
    ["реплика", messageDraft()],
  ])("отклоняет %s со ссылкой на неизвестную сборку", (_name, event) => {
    const raw = { ...uneditedDraft(), events: [{ ...event, build: "unknown" }] };

    const act = () => parseDraft(raw);

    expect(act).toThrow(/неизвестная сборка unknown/);
  });

  it("принимает промпт и реплику со ссылкой на сборку черновика", () => {
    const prompt = { t: 1, type: "draft_prompt", said: "а", goal: "", requirements: [] };
    const events = [
      { ...prompt, build: BUILD_ID },
      { ...messageDraft(), build: BUILD_ID, run: "a1" },
    ];

    const draft = parseDraft({ ...uneditedDraft(), events });

    expect(draft.events).toEqual(events);
  });

  it("отклоняет build не строкой", () => {
    const event = { t: 0, type: "draft_prompt", said: "а", goal: "", requirements: [], build: 1 };

    const act = () => parseDraft({ ...uneditedDraft(), events: [event] });

    expect(act).toThrow(/build/);
  });

  it("принимает окно запуска, исход проверок и событие цеха с запуском", () => {
    const events = [
      { t: 1, type: "draft_run", run: "a1", agent: "coder", until: 9 },
      { t: 2, type: "draft_check", ok: false, run: "a1" },
      { t: 3, type: "draft_check", ok: true },
      { t: 4, type: "stage_enter", stage: "code", run: "a1" },
    ];

    const draft = parseDraft({ ...uneditedDraft(), events });

    expect(draft.events).toEqual(events);
  });

  it.each([
    ["окно запуска без until", { t: 1, type: "draft_run", run: "a1", agent: "coder" }],
    ["окно запуска без agent", { t: 1, type: "draft_run", run: "a1", until: 2 }],
    ["проверка без ok", { t: 1, type: "draft_check" }],
    ["проверка с run не строкой", { t: 1, type: "draft_check", ok: true, run: 5 }],
    ["событие цеха с run не строкой", { t: 1, type: "stage_enter", stage: "code", run: 5 }],
    ["реплика с run не строкой", { ...messageDraft(), run: 5 }],
  ])("отклоняет %s", (_name, event) => {
    const act = () => parseDraft({ ...uneditedDraft(), events: [event] });

    expect(act).toThrow(DraftError);
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

  it("читает черновик из нескольких сборок без потерь", () => {
    const raw: unknown = JSON.parse(JSON.stringify(interleavedDraft()));

    const draft = parseDraft(raw);

    expect(draft).toEqual(interleavedDraft());
  });
});

describe("carryOverEdits", () => {
  it("переносит заголовок и редактуру промпта с тем же временем и текстом", () => {
    const previous = editedDraft();
    const next = uneditedDraft();

    const draft = carryOverEdits(previous, next);

    expect(draft).toEqual(editedDraft());
  });

  it("берёт сборки из прошлого черновика вместе с их запусками", () => {
    const previous = interleavedDraft();
    const next = uneditedDraft();

    const draft = carryOverEdits(previous, next);

    expect(draft.builds).toEqual(interleavedDraft().builds);
  });

  it("переносит заполненные редактором проект и версию завода первой сборки", () => {
    const previous = editedDraft();
    previous.builds = [{ ...buildOf(previous, 0), project: "demo", factory: "0.2.0" }];
    const next = uneditedDraft();
    next.builds = [{ ...buildOf(next, 0), project: "cyberzavod", factory: "0.1.0" }];

    const draft = carryOverEdits(previous, next);

    expect(draft.builds[0]).toMatchObject({ project: "demo", factory: "0.2.0" });
  });

  it("берёт проект и версию завода первой сборки из журнала, если редактор их не заполнил", () => {
    const previous = editedDraft();
    previous.builds = [{ ...buildOf(previous, 0), project: "", factory: "" }];
    const next = uneditedDraft();
    next.builds = [{ ...buildOf(next, 0), project: "cyberzavod", factory: "0.1.0" }];

    const draft = carryOverEdits(previous, next);

    expect(draft.builds[0]).toMatchObject({ project: "cyberzavod", factory: "0.1.0" });
  });

  it("не подставляет проект журнала в сборку, которую завёл редактор", () => {
    const previous = interleavedDraft();
    previous.builds = previous.builds.map((build) => ({ ...build, project: "", factory: "" }));
    const next = uneditedDraft();
    next.builds = [
      { ...buildOf(next, 0), id: FIRST_BUILD_ID, project: "cyberzavod", factory: "0.1.0" },
    ];

    const draft = carryOverEdits(previous, next);

    expect(draft.builds.map(({ project }) => project)).toEqual(["cyberzavod", ""]);
  });

  it("сохраняет найденную раньше модель, если транскрипта уже нет", () => {
    const previous = editedDraft();
    const next: Draft = {
      ...uneditedDraft(),
      events: [
        {
          t: 1_000,
          type: "draft_prompt",
          said: "добавь плз счетчик токенов над цехом",
          goal: "",
          requirements: [],
        },
      ],
    };

    const draft = carryOverEdits(previous, next);

    expect(draft.events[0]).toMatchObject({ model: "claude-opus-5-5" });
  });

  it("оставляет пустым новый промпт и промпт с другим текстом", () => {
    const previous = editedDraft();
    const next: Draft = {
      ...uneditedDraft(),
      events: [
        { t: 1_000, type: "draft_prompt", said: "другой текст", goal: "", requirements: [] },
        { t: 5_000, type: "draft_prompt", said: "новый промпт", goal: "", requirements: [] },
      ],
    };

    const draft = carryOverEdits(previous, next);

    expect(draft.events).toEqual(next.events);
  });

  it("переносит сборку, назначенную промпту, даже если больше ничего не заполнено", () => {
    const prompt: DraftPrompt = {
      t: 1_000,
      type: "draft_prompt",
      said: "начни вторую задачу",
      goal: "",
      requirements: [],
    };
    const previous = draftWith({ ...prompt, build: "second" });
    const next = draftWith(prompt);

    const draft = carryOverEdits(previous, next);

    expect(draft.events[0]).toEqual({ ...prompt, build: "second" });
  });
});

describe("carryOverEdits: реплики и склейка", () => {
  const edited = messageDraft({ line: "Сделай счётчик", text: "Сделай счётчик токенов." });

  it("переносит строку и текст реплики с тем же временем и исходным текстом", () => {
    const previous = draftWith(edited);
    const next = draftWith(messageDraft());

    const draft = carryOverEdits(previous, next);

    expect(draft.events[0]).toEqual(edited);
  });

  it("берёт маршрут, source и запуск из пересобранного черновика, а редактуру из прошлого", () => {
    const previous = draftWith(edited);
    const next = draftWith(messageDraft({ from: "test", to: "code", source: "report", run: "a1" }));

    const draft = carryOverEdits(previous, next);

    expect(draft.events[0]).toEqual({
      ...edited,
      from: "test",
      to: "code",
      source: "report",
      run: "a1",
    });
  });

  it("переносит сборку, назначенную реплике, вместе с отсутствующей строкой", () => {
    const previous = draftWith(messageDraft({ build: "second" }));
    const next = draftWith(messageDraft());

    const draft = carryOverEdits(previous, next);

    expect(draft.events[0]).toMatchObject({ build: "second", line: "" });
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

    expect(draft.events[0]).toMatchObject({ joined: true });
  });
});

describe("orphanedEdits", () => {
  it("находит редактуру промпта, исходный текст которого поменялся", () => {
    const previous = editedDraft();
    const next: Draft = {
      ...uneditedDraft(),
      events: [
        { t: 1_000, type: "draft_prompt", said: "другой текст", goal: "", requirements: [] },
      ],
    };

    const orphaned = promptsOnly(orphanedEdits(previous, next)).map((prompt) => prompt.goal);

    expect(orphaned).toEqual(["Добавь счётчик токенов"]);
  });

  it("находит и редактуру, где заполнены только требования", () => {
    const previous = uneditedDraft();
    previous.events[0] = {
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

describe("orphanedRuns", () => {
  it("находит запуски из сборок, которых нет среди окон запусков журнала", () => {
    const draft = interleavedDraft();
    buildOf(draft, 1).runs.push("опечатка");

    const runs = orphanedRuns(draft);

    expect(runs).toEqual(["опечатка"]);
  });

  it("не находит ничего, если окна есть у каждого запуска", () => {
    const draft = interleavedDraft();

    const runs = orphanedRuns(draft);

    expect(runs).toEqual([]);
  });
});

describe("reroutedMessages", () => {
  it("находит заполненную реплику, у которой поменялся маршрут", () => {
    const previous = draftWith(messageDraft({ to: "test", line: "Держи" }));
    const next = draftWith(messageDraft({ to: "foreman", line: "Держи" }));

    const rerouted = reroutedMessages(previous, next);

    expect(rerouted).toHaveLength(1);
  });

  it.each([
    ["у реплики не поменялся маршрут", messageDraft({ line: "Держи" })],
    ["реплика ещё не заполнена", messageDraft({ to: "test" })],
  ])("не находит ничего, если %s", (_name, now) => {
    const previous = draftWith(messageDraft({ line: "Держи" }));

    const rerouted = reroutedMessages(previous, draftWith(now));

    expect(rerouted).toEqual([]);
  });

  it("не считает потерей новую реплику без пары в прошлом черновике", () => {
    const previous = draftWith();
    const next = draftWith(messageDraft({ line: "Держи" }));

    const rerouted = reroutedMessages(previous, next);

    expect(rerouted).toEqual([]);
  });
});

describe("publishBuild", () => {
  it("публикует промпты без исходного текста, но с моделью, а время считает от начала сборки", () => {
    const draft = editedDraft();

    const recording = publishOnly(draft);

    expect(recording.events[1]).toEqual({
      t: 0,
      type: "prompt",
      goal: "Добавь счётчик токенов",
      requirements: ["Показывай его над цехом"],
      model: "claude-opus-5-5",
    });
  });

  it("не публикует черновик без чистовой версии промпта", () => {
    const draft = uneditedDraft();
    buildOf(draft, 0).title = "Счётчик токенов";

    const act = () => publishOnly(draft);

    expect(act).toThrow(/goal/);
  });

  it("переносит проект и версию завода в запись", () => {
    const draft = editedDraft();

    const recording = publishOnly(draft);

    expect(recording).toMatchObject({ version: 2, project: "cyberzavod", factory: "0.1.0" });
  });

  it.each(["project", "factory"] as const)("не публикует сборку с пустым полем %s", (field) => {
    const draft = editedDraft();
    buildOf(draft, 0)[field] = "";

    const act = () => publishOnly(draft);

    expect(act).toThrow(RecordingError);
    expect(act).toThrow(new RegExp(field));
  });

  it("проверяет на утечки версию завода", () => {
    const draft = editedDraft();
    buildOf(draft, 0).factory = "сервер 203.0.113.7";

    const act = () => publishOnly(draft);

    expect(act).toThrow(DraftError);
  });

  it("не публикует сборку без заголовка", () => {
    const draft = editedDraft();
    buildOf(draft, 0).title = "";

    const act = () => publishOnly(draft);

    expect(act).toThrow(/title/);
  });

  it("проверяет на утечки и причину возврата на доработку", () => {
    const draft = editedDraft();
    draft.events[1] = {
      t: 2_000,
      type: "stage_fail",
      stage: "test",
      reason: "нет доступа к 203.0.113.7",
    };

    const act = () => publishOnly(draft);

    expect(act).toThrow(/IP-адрес/);
  });

  it("проверяет на утечки и модель промпта", () => {
    const draft = editedDraft();
    draft.events[0] = {
      t: 1_000,
      type: "draft_prompt",
      said: "текст",
      goal: "Добавь счётчик",
      requirements: [],
      model: "arn:aws:bedrock:203.0.113.7",
    };

    const act = () => publishOnly(draft);

    expect(act).toThrow(/IP-адрес/);
  });

  it("не публикует адрес сервера, попавший в чистовую версию", () => {
    const draft = editedDraft();
    draft.events[0] = {
      t: 1_000,
      type: "draft_prompt",
      said: "зайди на 203.0.113.7",
      goal: "Зайти на сервер 203.0.113.7",
      requirements: [],
    };

    const act = () => publishOnly(draft);

    expect(act).toThrow(/IP-адрес/);
  });

  it("публикует реплику без исходного текста, source и запуска", () => {
    const draft = editedDraft();
    draft.events.splice(
      1,
      0,
      messageDraft({
        t: 1_500,
        run: "a1",
        line: "Сделай счётчик",
        text: "Сделай счётчик токенов.",
      }),
    );

    const recording = publishOnly(draft);

    expect(recording.events[2]).toEqual({
      t: 500,
      type: "message",
      from: "code",
      to: "foreman",
      line: "Сделай счётчик",
      text: "Сделай счётчик токенов.",
    });
  });

  it("не публикует черновик с непроставленной репликой", () => {
    const draft = editedDraft();
    draft.events.splice(1, 0, messageDraft());

    const act = () => publishOnly(draft);

    expect(act).toThrow(/line/);
  });

  it("пропускает склеенные промпты", () => {
    const draft = editedDraft();
    draft.events.splice(1, 0, {
      t: 1_800,
      type: "draft_prompt",
      said: "да",
      goal: "",
      requirements: [],
      joined: true,
    });

    const recording = publishOnly(draft);

    expect(recording.events.filter((event) => event.type === "prompt")).toHaveLength(1);
  });

  it("не публикует склеенный первый промпт", () => {
    const draft = editedDraft();
    draft.events.splice(0, 0, {
      t: 500,
      type: "draft_prompt",
      said: "да",
      goal: "",
      requirements: [],
      joined: true,
    });

    const act = () => publishOnly(draft);

    expect(act).toThrow(DraftError);
  });

  it("не публикует промпт, склеенный первым в сборке, даже если в другой сборке промпты есть", () => {
    const draft = interleavedDraft();
    draft.events = draft.events.map((event) =>
      event.type === "draft_prompt" && event.build === SECOND_BUILD_ID
        ? { ...event, joined: true }
        : event,
    );

    const act = () => publishBuild(draft, SECOND_BUILD_ID);

    expect(act).toThrow(DraftError);
  });

  it.each([
    ["строке", { line: "Зайти на 203.0.113.7", text: "Текст" }],
    ["тексте", { line: "Зайти", text: "Зайди на 203.0.113.7" }],
  ])("не публикует адрес сервера в %s реплики", (_name, patch) => {
    const draft = editedDraft();
    draft.events.splice(1, 0, messageDraft(patch));

    const act = () => publishOnly(draft);

    expect(act).toThrow(/IP-адрес/);
  });

  it("не повторяет этап, на котором сборка уже стоит", () => {
    const draft = editedDraft();
    draft.events.push(
      { t: 2_500, type: "stage_enter", stage: "code", run: "a2" },
      { t: 3_000, type: "stage_enter", stage: "test" },
      { t: 3_500, type: "stage_enter", stage: "code" },
    );

    const recording = publishOnly(draft);

    const stages = recording.events.flatMap((event) =>
      event.type === "stage_enter" ? [event.stage] : [],
    );
    expect(stages).toEqual(["code", "test", "code"]);
  });

  it("ставит build_start в нуль и отбрасывает старые начало и конец черновика", () => {
    const draft = editedDraft();
    draft.events = [
      { t: 0, type: "build_start" },
      ...draft.events,
      { t: 99_000_000, type: "build_end", ok: false },
    ];

    const recording = publishOnly(draft);

    expect(recording.events.map((event) => [event.t, event.type])).toEqual([
      [0, "build_start"],
      [0, "prompt"],
      [1_000, "stage_enter"],
      [1_000, "build_end"],
    ]);
  });

  it("считает сборку без проверок удачной", () => {
    const draft = editedDraft();

    const recording = publishOnly(draft);

    expect(recording.events.at(-1)).toMatchObject({ type: "build_end", ok: true });
  });

  it("не оставляет в записи служебных событий и пометок черновика", () => {
    const draft = interleavedDraft();

    const recording = publishBuild(draft, FIRST_BUILD_ID);

    const marks = ["draft_", "run", "said", "source", 'build":'];
    expect(marks.filter((mark) => JSON.stringify(recording).includes(`"${mark}`))).toEqual([]);
  });

  it("не публикует сборку из неизвестной сборки и сборку без событий", () => {
    const draft = editedDraft();
    draft.builds.push({ id: "empty", project: "p", factory: "0.1.0", title: "Пустая", runs: [] });

    const unknown = () => publishBuild(draft, "no-such-build");
    const empty = () => publishBuild(draft, "empty");

    expect(unknown).toThrow(/нет сборки no-such-build/);
    expect(empty).toThrow(/нет событий/);
  });
});

describe("publishDraft: несколько сборок", () => {
  it("публикует две записи со своими id, проектом, версией, заголовком и временем начала", () => {
    const draft = interleavedDraft();

    const recordings = publishDraft(draft);

    expect(
      recordings.map(({ id, project, factory, title, startedAt }) => ({
        id,
        project,
        factory,
        title,
        startedAt,
      })),
    ).toEqual([
      {
        id: FIRST_BUILD_ID,
        project: "cyberzavod",
        factory: "0.1.0",
        title: "Счётчик токенов",
        startedAt: "2026-10-04T09:52:13.000Z",
      },
      {
        id: SECOND_BUILD_ID,
        project: "personal-finance-lab",
        factory: "0.1.0",
        title: "Движок финансов",
        startedAt: "2026-10-04T09:52:15.000Z",
      },
    ]);
  });

  it("кладёт в каждую запись только события своих запусков и участков основной сессии", () => {
    const draft = interleavedDraft();

    const recordings = publishDraft(draft);

    const summary = recordings.map((recording) =>
      recording.events.flatMap((event) => {
        if (event.type === "prompt") return [event.goal];
        if (event.type === "stage_enter") return [event.stage];
        if (event.type === "stage_fail") return [`fail:${event.stage}`];
        return [];
      }),
    );
    expect(summary).toEqual([
      ["Добавь счётчик токенов", "spec", "code", "test", "fail:test"],
      ["Сделай движок финансов", "code", "test"],
    ]);
  });

  it("сжимает паузу ожидания первой задачи и не трогает вторую", () => {
    const draft = interleavedDraft();

    const recordings = publishDraft(draft);

    const lastEventBeforeWaiting = 31_000;
    const waiting = 200_000 - lastEventBeforeWaiting;
    const ends = recordings.map((recording) => recording.events.at(-1)?.t);
    expect(ends).toEqual([250_000 - (waiting - IDLE_GAP_MS), 58_000]);
  });

  it("считает токены записи по её станциям и участкам основной сессии", () => {
    const draft = interleavedDraft();

    const recordings = publishDraft(draft);

    const tokens = recordings.map((recording) =>
      recording.events.flatMap((event) => (event.type === "usage" ? [event.tokens] : [])),
    );
    expect(tokens).toEqual([[822], [370]]);
  });

  it("даёт в сумме по записям столько токенов, сколько в черновике", () => {
    const draft = interleavedDraft();
    const inDraft = draft.events.reduce((sum, e) => sum + (e.type === "usage" ? e.tokens : 0), 0);

    const recordings = publishDraft(draft);

    const inRecordings = recordings
      .flatMap((recording) => recording.events)
      .reduce((sum, event) => sum + (event.type === "usage" ? event.tokens : 0), 0);
    expect(inRecordings).toBe(inDraft);
  });

  it("ставит usage перед build_end и один раз", () => {
    const draft = interleavedDraft();

    const [recording] = publishDraft(draft);

    expect(recording?.events.slice(-2).map((event) => event.type)).toEqual(["usage", "build_end"]);
  });

  it("берёт итог сборки из её последней проверки: провал соседней сборки не мешает", () => {
    const draft = interleavedDraft();

    const recordings = publishDraft(draft);

    const outcomes = recordings.map((recording) => recording.events.at(-1));
    expect(outcomes).toEqual([
      { t: expect.any(Number), type: "build_end", ok: false },
      { t: expect.any(Number), type: "build_end", ok: true },
    ]);
  });

  it("публикует вторую сборку, даже если первая не заполнена", () => {
    const draft = interleavedDraft();
    buildOf(draft, 0).title = "";

    const recording = publishBuild(draft, SECOND_BUILD_ID);

    expect(recording.id).toBe(SECOND_BUILD_ID);
  });

  it("не публикует ничего, если не готова хоть одна сборка", () => {
    const draft = interleavedDraft();
    buildOf(draft, 0).title = "";

    const act = () => publishDraft(draft);

    expect(act).toThrow(/title/);
  });

  it("ищет утечки в каждой записи отдельно", () => {
    const draft = interleavedDraft();
    draft.events = draft.events.map((event) =>
      event.type === "draft_message" && event.run === "b2"
        ? { ...event, text: "Зайди на 203.0.113.7" }
        : event,
    );

    const first = () => publishBuild(draft, FIRST_BUILD_ID);
    const second = () => publishBuild(draft, SECOND_BUILD_ID);

    expect(first).not.toThrow();
    expect(second).toThrow(/IP-адрес/);
  });

  it("публикует черновик с одной сборкой одной записью с id черновика", () => {
    const draft = editedDraft();

    const recordings = publishDraft(draft);

    expect(recordings.map((recording) => recording.id)).toEqual([draft.id]);
  });
});

describe("unfilledHeader", () => {
  it("не называет ничего, если шапка каждой сборки заполнена", () => {
    const draft = interleavedDraft();

    const names = unfilledHeader(draft);

    expect(names).toEqual([]);
  });

  it("называет все пустые поля сборки по порядку шапки", () => {
    const draft = editedDraft();
    draft.builds = [{ ...buildOf(draft, 0), title: "", project: "", factory: "" }];

    const names = unfilledHeader(draft);

    expect(names).toEqual([`сборка ${BUILD_ID}: заголовок, проект, версия завода`]);
  });

  it("называет пустые поля по каждой сборке и пропускает заполненные", () => {
    const draft = interleavedDraft();
    draft.builds[1] = { ...buildOf(draft, 1), title: "", project: "" };

    const names = unfilledHeader(draft);

    expect(names).toEqual([`сборка ${SECOND_BUILD_ID}: заголовок, проект`]);
  });
});
