import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "@cyberzavod/core";
import {
  isSafeSessionId,
  markAfterStopGate,
  parseRawLog,
  RawLogError,
  stampProject,
  subagentNameOf,
  verdictOf,
  withOptional,
} from "./raw-event.ts";

const TS = 1_000;

describe("markAfterStopGate", () => {
  it("помечает промпт и не меняет остальное", () => {
    const prompt = { ts: TS, kind: "prompt", text: "Продолжай" } as const;

    const marked = markAfterStopGate(prompt);

    expect(marked).toEqual({ ts: TS, kind: "prompt", text: "Продолжай", afterStopGate: true });
  });

  it("не меняет исходный промпт", () => {
    const prompt = { ts: TS, kind: "prompt", text: "Продолжай" } as const;

    markAfterStopGate(prompt);

    expect(prompt).toEqual({ ts: TS, kind: "prompt", text: "Продолжай" });
  });
});

describe("isSafeSessionId", () => {
  it("принимает id сессии и отклоняет пути и не-строки", () => {
    const candidates = ["744e7547-d312-42c4-88a0-fd9089104079", "../../evil", "a/b", "", 42];

    const results = candidates.map(isSafeSessionId);

    expect(results).toEqual([true, false, false, false, false]);
  });
});

function projectConfig(): ProjectConfig {
  return {
    projectId: "cyberzavod",
    harness: "0.1.0",
    workflow: "default",
    journal: "journal",
    agents: {},
    verification: { commands: [], paths: [] },
  };
}

describe("stampProject", () => {
  it("добавляет к началу сессии проект, версию harness и процесс", () => {
    const event = { ts: TS, kind: "session_start" } as const;

    const stamped = stampProject(event, projectConfig());

    expect(stamped).toEqual({
      ts: TS,
      kind: "session_start",
      project: "cyberzavod",
      harness: "0.1.0",
      workflow: "default",
    });
  });

  it("не меняет исходное событие", () => {
    const event = { ts: TS, kind: "session_start" } as const;

    stampProject(event, projectConfig());

    expect(event).toEqual({ ts: TS, kind: "session_start" });
  });
});

describe("parseRawLog", () => {
  it("пропускает оборванную строку и читает остальные", () => {
    const log = '{"ts":1,"kind":"session_start"}\n{"ts":2,"kind":"pro\n{"ts":3,"kind":"stop"}\n';

    const events = parseRawLog(log);

    expect(events).toEqual([
      { ts: 1, kind: "session_start" },
      { ts: 3, kind: "stop" },
    ]);
  });

  it("отклоняет строку не той формы с номером строки в ошибке", () => {
    const log = '{"ts":1,"kind":"session_start"}\n{"foo":"bar"}\n';

    const act = () => parseRawLog(log);

    expect(act).toThrow(new RawLogError("line 2: not a log event"));
  });

  it("отклоняет событие без обязательного поля своего вида", () => {
    const log = '{"ts":1,"kind":"prompt"}\n';

    const act = () => parseRawLog(log);

    expect(act).toThrow(RawLogError);
  });

  it("принимает начало сессии с проектом и без него", () => {
    const log =
      '{"ts":1,"kind":"session_start","project":"cyberzavod","harness":"0.1.0","workflow":"default"}\n{"ts":2,"kind":"session_start"}\n';

    const events = parseRawLog(log);

    expect(events).toEqual([
      {
        ts: 1,
        kind: "session_start",
        project: "cyberzavod",
        harness: "0.1.0",
        workflow: "default",
      },
      { ts: 2, kind: "session_start" },
    ]);
  });

  it.each([
    '{"ts":1,"kind":"session_start","project":"cyberzavod"}\n',
    '{"ts":1,"kind":"session_start","harness":"0.1.0"}\n',
    '{"ts":1,"kind":"session_start","project":"cyberzavod","harness":"0.1.0"}\n',
    '{"ts":1,"kind":"session_start","project":"cyberzavod","harness":1,"workflow":"default"}\n',
  ])("отклоняет начало сессии с одним полем проекта или не строкой: %s", (log) => {
    const act = () => parseRawLog(log);

    expect(act).toThrow(RawLogError);
  });

  it("принимает question_answer и afterStopGate", () => {
    const log =
      '{"ts":1,"kind":"question_answer","text":"Какой кэш? — Без кэша"}\n{"ts":2,"kind":"prompt","text":"Продолжай","afterStopGate":true}\n';

    const events = parseRawLog(log);

    expect(events).toEqual([
      { ts: 1, kind: "question_answer", text: "Какой кэш? — Без кэша" },
      { ts: 2, kind: "prompt", text: "Продолжай", afterStopGate: true },
    ]);
  });

  it.each([false, "yes"])("отклоняет afterStopGate не true: %s", (afterStopGate) => {
    const log = `${JSON.stringify({ ts: 1, kind: "prompt", text: "Продолжай", afterStopGate })}\n`;

    const act = () => parseRawLog(log);

    expect(act).toThrow(RawLogError);
  });

  it("отклоняет question_answer без текста", () => {
    const log = '{"ts":1,"kind":"question_answer"}\n';

    const act = () => parseRawLog(log);

    expect(act).toThrow(RawLogError);
  });
});

describe("verdictOf", () => {
  it.each([
    ["**APPROVED**\n\nвсё хорошо", "APPROVED"],
    ["# NEEDS WORK.", "NEEDS WORK"],
    ["[note from the environment]\nDEFECT", "DEFECT"],
  ])("берёт первую строку без оформления и точки: %s", (reply, verdict) => {
    const result = verdictOf(reply);

    expect(result).toBe(verdict);
  });

  it("не принимает за вердикт длинную первую строку и пустой ответ", () => {
    const long = "Я посмотрел изменения и считаю, что нужно поправить несколько мест";

    const verdicts = [verdictOf(long), verdictOf(undefined), verdictOf("")];

    expect(verdicts).toEqual([undefined, undefined, undefined]);
  });
});

describe("subagentNameOf", () => {
  it("берёт agent_type, а пустой и отсутствующий называет unknown", () => {
    const names = [
      subagentNameOf({ agent_type: "reviewer" }),
      subagentNameOf({ agent_type: "" }),
      subagentNameOf({}),
    ];

    expect(names).toEqual(["reviewer", "unknown", "unknown"]);
  });
});

describe("withOptional", () => {
  it("добавляет только заданные поля", () => {
    const event = { ts: TS, kind: "stop" } as const;

    const withPath = withOptional<{ ts: number; kind: "stop"; transcriptPath?: string }>(event, {
      transcriptPath: undefined,
    });

    expect(withPath).toEqual({ ts: TS, kind: "stop" });
  });

  it("добавляет присутствующее поле", () => {
    const event = { ts: TS, kind: "stop" } as const;

    const withPath = withOptional<{ ts: number; kind: "stop"; transcriptPath?: string }>(event, {
      transcriptPath: "/t/main.jsonl",
    });

    expect(withPath).toEqual({ ts: TS, kind: "stop", transcriptPath: "/t/main.jsonl" });
  });
});
