import { describe, expect, it } from "vitest";
import {
  briefOf,
  INTERVENTION_REASONS,
  NO_TALLY,
  parseRecord,
  RecordError,
  summarize,
  tally,
  type SessionRecord,
} from "./record.ts";

// Сессия как сырой JSON: тесты портят её как угодно, проверяет parseRecord.
interface RawSession {
  version: number;
  type: string;
  id: string;
  timestamp: string;
  projectId: string;
  sessionId?: string;
  source: Record<string, unknown>;
  data: {
    title: string;
    workflow: string;
    harness: string;
    events: Record<string, unknown>[];
  };
}

function validSession(): RawSession {
  return {
    version: 1,
    type: "session",
    id: "demo-1",
    timestamp: "2026-10-04T09:52:13.000Z",
    projectId: "demo",
    source: { type: "agent", provider: "anthropic", agent: "claude" },
    data: {
      title: "Счётчики над цехом",
      workflow: "default",
      harness: "0.1.0",
      events: [
        { t: 0, type: "build_start" },
        {
          t: 10,
          type: "prompt",
          goal: "Добавь счётчик токенов",
          requirements: ["Показывай его над цехом", "Разбивай число по разрядам"],
          model: "claude-opus-5-5",
        },
        { t: 20, type: "stage_enter", stage: "implementation" },
        { t: 30, type: "usage", tokens: 1200 },
        { t: 40, type: "stage_enter", stage: "verification" },
        { t: 50, type: "stage_fail", stage: "verification", reason: "упал тест" },
        { t: 60, type: "stage_enter", stage: "implementation" },
        { t: 70, type: "usage", tokens: 800 },
        { t: 90, type: "build_end", ok: true },
      ],
    },
  };
}

function withData(patch: Record<string, unknown>): RawSession {
  const raw = validSession();
  return { ...raw, data: { ...raw.data, ...patch } };
}

function parseSession(raw: unknown): SessionRecord {
  const record = parseRecord(raw);
  if (record.type !== "session") throw new Error(`ждали сессию, пришло ${record.type}`);
  return record;
}

describe("parseRecord", () => {
  it("принимает корректную запись", () => {
    const raw = validSession();

    const recording = parseSession(raw);

    expect(recording.data.events).toHaveLength(raw.data.events.length);
  });

  it("возвращает конверт и данные сессии", () => {
    const raw = validSession();

    const recording = parseSession(raw);

    expect(recording).toMatchObject({
      version: 1,
      projectId: "demo",
      source: { type: "agent", provider: "anthropic", agent: "claude" },
      data: { workflow: "default", harness: "0.1.0" },
    });
  });

  it("сохраняет сессию агента, если она известна", () => {
    const raw = { ...validSession(), sessionId: "744e7547" };

    const recording = parseSession(raw);

    expect(recording.sessionId).toBe("744e7547");
  });

  it.each([2, 3])("отклоняет версию %i", (version) => {
    const raw = { ...validSession(), version };

    const act = () => parseRecord(raw);

    expect(act).toThrow(new RegExp(`неподдерживаемая версия ${version}`));
  });

  it("отклоняет неизвестный тип записи", () => {
    const raw = { ...validSession(), type: "milestone" };

    const act = () => parseRecord(raw);

    expect(act).toThrow(/тип записи milestone/);
  });

  it.each([
    ["без источника", undefined, /source/],
    ["неизвестный источник", { type: "robot" }, /источник robot/],
    ["агент без провайдера", { type: "agent", agent: "claude" }, /provider/],
    ["агент без имени", { type: "agent", provider: "anthropic" }, /agent/],
  ])("отклоняет источник: %s", (_name, source, message) => {
    const raw = { ...validSession(), source };

    const act = () => parseRecord(raw);

    expect(act).toThrow(message);
  });

  it.each(["../demo", "demo/1", ""])("отклоняет проект «%s»", (projectId) => {
    const raw = { ...validSession(), projectId };

    const act = () => parseRecord(raw);

    expect(act).toThrow(/projectId/);
  });

  it.each(["workflow", "harness"])("отклоняет сессию без %s", (field) => {
    const raw = withData({ [field]: undefined });

    const act = () => parseRecord(raw);

    expect(act).toThrow(new RegExp(field));
  });

  it.each(["", "  ", "0.1.0\n0.2.0"])("отклоняет версию harness «%s»", (harness) => {
    const raw = withData({ harness });

    const act = () => parseRecord(raw);

    expect(act).toThrow(/harness/);
  });

  it("отклоняет неизвестный этап", () => {
    const raw = validSession();
    raw.data.events[2] = { t: 20, type: "stage_enter", stage: "deploy" };

    const act = () => parseRecord(raw);

    expect(act).toThrow(RecordError);
  });

  it("не даёт времени идти назад", () => {
    const raw = validSession();
    raw.data.events[3] = { t: 5, type: "usage", tokens: 1200 };

    const act = () => parseRecord(raw);

    expect(act).toThrow(/время идёт назад/);
  });

  it("отклоняет промпт без цели", () => {
    const raw = validSession();
    raw.data.events[1] = { t: 10, type: "prompt", goal: " ", requirements: [] };

    const act = () => parseRecord(raw);

    expect(act).toThrow(/goal/);
  });

  it("сохраняет модель, получившую промпт", () => {
    const raw = validSession();

    const recording = parseSession(raw);

    expect(recording.data.events[1]).toMatchObject({ model: "claude-opus-5-5" });
  });

  it("принимает промпт без модели", () => {
    const raw = validSession();
    raw.data.events[1] = { t: 10, type: "prompt", goal: "Цель", requirements: [] };

    const recording = parseSession(raw);

    expect(recording.data.events[1]).not.toHaveProperty("model");
  });

  it("отклоняет пустую модель", () => {
    const raw = validSession();
    raw.data.events[1] = { t: 10, type: "prompt", goal: "Цель", requirements: [], model: "" };

    const act = () => parseRecord(raw);

    expect(act).toThrow(/model/);
  });

  it("отклоняет требование в несколько строк", () => {
    const raw = validSession();
    raw.data.events[1] = { t: 10, type: "prompt", goal: "Цель", requirements: ["первое\nвторое"] };

    const act = () => parseRecord(raw);

    expect(act).toThrow(/requirements/);
  });

  it.each(["04.10.2026", "2026-10-04", "2026-02-31T00:00:00.000Z"])(
    "отклоняет время начала «%s»",
    (timestamp) => {
      const raw = { ...validSession(), timestamp };

      const act = () => parseRecord(raw);

      expect(act).toThrow(/timestamp/);
    },
  );

  it.each(["../demo", "demo/1", ""])("отклоняет id «%s», непригодный для имени файла", (id) => {
    const raw = { ...validSession(), id };

    const act = () => parseRecord(raw);

    expect(act).toThrow(/id/);
  });

  it.each(["", "  ", "первая строка\nвторая"])("отклоняет заголовок «%s»", (title) => {
    const raw = withData({ title });

    const act = () => parseRecord(raw);

    expect(act).toThrow(/title/);
  });

  it("отклоняет запись без build_end", () => {
    const raw = validSession();
    raw.data.events.pop();

    const act = () => parseRecord(raw);

    expect(act).toThrow(/build_end/);
  });
});

describe("summarize", () => {
  it("считает длительность, токены, промпты и возвраты", () => {
    const recording = parseSession(validSession());

    const stats = summarize(recording);

    expect(stats).toEqual({
      durationMs: 90,
      tokens: 2000,
      prompts: 1,
      reworks: 1,
      interventions: 0,
      ok: true,
    });
  });

  it("считает вмешательства отдельно от промптов", () => {
    const raw = validSession();
    raw.data.events.splice(3, 0, interventionEvent(), interventionEvent({ t: 26 }));
    const recording = parseSession(raw);

    const stats = summarize(recording);

    expect(stats).toMatchObject({ prompts: 1, interventions: 2 });
  });
});

function messageEvent(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    t: 25,
    type: "message",
    from: "foreman",
    to: "implementation",
    line: "Сделай счётчик",
    text: "Сделай счётчик токенов.\n\nПоказывай его над цехом.",
    ...patch,
  };
}

describe("parseRecord: реплики", () => {
  it("принимает реплику мастера станции, станции мастеру и станции станции", () => {
    const raw = validSession();
    raw.data.events.splice(
      3,
      0,
      messageEvent(),
      messageEvent({ from: "implementation", to: "foreman" }),
      messageEvent({ from: "implementation", to: "verification" }),
    );

    const recording = parseSession(raw);

    expect(recording.data.events.filter((event) => event.type === "message")).toHaveLength(3);
  });

  it.each([
    ["дирижёр говорящий", { from: "conductor" }, /говорящий/],
    ["человек говорящий", { from: "human" }, /говорящий/],
    ["неизвестный говорящий", { from: "deploy" }, /говорящий/],
    ["дирижёр адресат", { to: "conductor" }, /адресат/],
    ["человек адресат", { to: "human" }, /адресат/],
    ["неизвестный адресат", { to: "deploy" }, /адресат/],
    [
      "рабочий говорит сам с собой",
      { from: "implementation", to: "implementation" },
      /сам с собой/,
    ],
    ["мастер говорит сам с собой", { from: "foreman", to: "foreman" }, /сам с собой/],
    ["многострочная строка", { line: "раз\nдва" }, /line/],
    ["пустая строка", { line: "  " }, /line/],
    ["пустой текст", { text: " \n " }, /text/],
    ["текст не строка", { text: 5 }, /text/],
  ])("отклоняет реплику: %s", (_name, patch, message) => {
    const raw = validSession();
    raw.data.events.splice(3, 0, messageEvent(patch));

    const act = () => parseRecord(raw);

    expect(act).toThrow(message);
  });

  it("сохраняет переводы строк в полном тексте", () => {
    const raw = validSession();
    raw.data.events.splice(3, 0, messageEvent());

    const recording = parseSession(raw);

    expect(recording.data.events[3]).toMatchObject({ text: expect.stringContaining("\n\n") });
  });
});

describe("briefOf", () => {
  it("убирает полный текст у реплик и не трогает остальное", () => {
    const raw = validSession();
    raw.data.events.splice(3, 0, messageEvent());
    const recording = parseSession(raw);

    const brief = briefOf(recording);

    expect(brief.data.events).toEqual([
      ...recording.data.events.slice(0, 3),
      { t: 25, type: "message", from: "foreman", to: "implementation", line: "Сделай счётчик" },
      ...recording.data.events.slice(4),
    ]);
  });

  it("убирает полный текст у вмешательства", () => {
    const raw = validSession();
    raw.data.events.splice(3, 0, interventionEvent());
    const recording = parseSession(raw);

    const brief = briefOf(recording);

    expect(brief.data.events[3]).toEqual({
      t: 25,
      type: "intervention",
      reason: "question",
      line: "Возьми вариант с таблицей",
    });
  });
});

describe("tally", () => {
  it("не меняет счётчики на реплике", () => {
    const event = {
      t: 1,
      type: "message",
      from: "record",
      to: "foreman",
      line: "Готово",
    } as const;

    const counts = tally(NO_TALLY, event);

    expect(counts).toEqual(NO_TALLY);
  });

  it("считает вмешательство отдельно от остального", () => {
    const event = {
      t: 1,
      type: "intervention",
      reason: "stop_gate",
      line: "Продолжай",
    } as const;

    const counts = tally(NO_TALLY, event);

    expect(counts).toEqual({ ...NO_TALLY, interventions: 1 });
  });
});

function interventionEvent(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    t: 25,
    type: "intervention",
    reason: "question",
    line: "Возьми вариант с таблицей",
    text: "Возьми вариант с таблицей.\n\nКэш не нужен.",
    ...patch,
  };
}

describe("parseRecord: вмешательства", () => {
  it.each(INTERVENTION_REASONS)("принимает причину %s", (reason) => {
    const raw = validSession();
    raw.data.events.splice(3, 0, interventionEvent({ reason }));

    const recording = parseSession(raw);

    expect(recording.data.events[3]).toMatchObject({ type: "intervention", reason });
  });

  it("отклоняет неизвестную причину", () => {
    const raw = validSession();
    raw.data.events.splice(3, 0, interventionEvent({ reason: "approval" }));

    const act = () => parseRecord(raw);

    expect(act).toThrow(/причина approval/);
  });

  it.each([
    ["пустая строка", { line: "  " }, /line/],
    ["многострочная строка", { line: "раз\nдва" }, /line/],
    ["пустой текст", { text: " \n " }, /text/],
    ["текст не строка", { text: 5 }, /text/],
  ])("отклоняет вмешательство: %s", (_name, patch, message) => {
    const raw = validSession();
    raw.data.events.splice(3, 0, interventionEvent(patch));

    const act = () => parseRecord(raw);

    expect(act).toThrow(message);
  });

  it("сохраняет переводы строк в полном тексте", () => {
    const raw = validSession();
    raw.data.events.splice(3, 0, interventionEvent());

    const recording = parseSession(raw);

    expect(recording.data.events[3]).toMatchObject({ text: expect.stringContaining("\n\n") });
  });
});

function manualRecord(type: string, data: Record<string, unknown>): Record<string, unknown> {
  const { version, timestamp, projectId } = validSession();
  return {
    version,
    type,
    id: "use-indexeddb",
    timestamp,
    projectId,
    source: { type: "manual" },
    data,
  };
}

describe("parseRecord: решения и заметки", () => {
  it("принимает решение с заголовком и описанием", () => {
    const raw = manualRecord("decision", { title: "Храним в IndexedDB", description: "Растёт." });

    const record = parseRecord(raw);

    expect(record).toMatchObject({
      type: "decision",
      source: { type: "manual" },
      data: { title: "Храним в IndexedDB", description: "Растёт." },
    });
  });

  it("отклоняет решение без заголовка", () => {
    const raw = manualRecord("decision", { title: " ", description: "" });

    const act = () => parseRecord(raw);

    expect(act).toThrow(/title/);
  });

  it("принимает заметку", () => {
    const raw = manualRecord("note", { text: "Переписан движок." });

    const record = parseRecord(raw);

    expect(record).toMatchObject({ type: "note", data: { text: "Переписан движок." } });
  });

  it("отклоняет пустую заметку", () => {
    const raw = manualRecord("note", { text: " " });

    const act = () => parseRecord(raw);

    expect(act).toThrow(/text/);
  });
});
