import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import {
  ConfigTomlError,
  TRUST_MARK,
  trustLines,
  trustReading,
  withoutTrust,
  withTrust,
  type ConfigProblem,
  type TrustEdit,
} from "./config-toml.ts";

const PROJECT = "/work/my project";
const STOP_KEY = `${PROJECT}/.codex/hooks.json:stop:0:1`;
const START_KEY = `${PROJECT}/.codex/hooks.json:session_start:0:0`;

function trustEdit(): TrustEdit {
  return {
    projectKey: PROJECT,
    hooks: [
      { key: START_KEY, hash: "sha256:aaa" },
      { key: STOP_KEY, hash: "sha256:bbb" },
    ],
  };
}

function problemOf(act: () => unknown): ConfigProblem {
  try {
    act();
  } catch (err) {
    if (err instanceof ConfigTomlError) return err.problem;

    throw err;
  }

  throw new Error("ожидалась ConfigTomlError");
}

describe("trustReading", () => {
  it("видит доверенный проект и хуки с тем же хешем", () => {
    const text = [
      `[projects."${PROJECT}"]`,
      'trust_level = "trusted"',
      "",
      `[hooks.state."${START_KEY}"]`,
      'trusted_hash = "sha256:aaa"',
      "",
      `[hooks.state."${STOP_KEY}"]`,
      'trusted_hash = "sha256:old"',
    ].join("\n");

    const reading = trustReading(text, trustEdit());

    expect(reading.isProjectTrusted).toBe(true);
    expect(reading.isProjectMarked).toBe(false);
    expect(reading.trustedHooks.map(({ key }) => key)).toEqual([START_KEY]);
    expect(reading.untrustedHooks.map(({ key }) => key)).toEqual([STOP_KEY]);
  });

  it("узнаёт строку доверия с нашей отметкой", () => {
    const text = `[projects."${PROJECT}"]\ntrust_level = "trusted" ${TRUST_MARK}\n`;

    const reading = trustReading(text, trustEdit());

    expect(reading.isProjectMarked).toBe(true);
  });

  it("не считает проект доверенным при другом значении", () => {
    const text = `[projects."${PROJECT}"]\ntrust_level = "untrusted"\n`;

    const reading = trustReading(text, trustEdit());

    expect(reading.isProjectTrusted).toBe(false);
  });

  it("без ключа проекта смотрит только на хуки", () => {
    const reading = trustReading("", { hooks: trustEdit().hooks });

    expect(reading.isProjectTrusted).toBe(false);
    expect(reading.untrustedHooks).toHaveLength(2);
  });

  it("отвергает текст, который не TOML", () => {
    const act = () => trustReading("key = ", trustEdit());

    expect(problemOf(act).kind).toBe("notParsed");
  });
});

describe("withTrust", () => {
  it("пишет доверие в пустой файл с отметкой, читаемое настоящим парсером", () => {
    const result = withTrust("", trustEdit());

    expect(result).toContain(`trust_level = "trusted" ${TRUST_MARK}`);
    expect(parse(result)).toEqual({
      projects: { [PROJECT]: { trust_level: "trusted" } },
      hooks: {
        state: {
          [START_KEY]: { trusted_hash: "sha256:aaa" },
          [STOP_KEY]: { trusted_hash: "sha256:bbb" },
        },
      },
    });
  });

  it("не меняет ни байта в чужих строках и комментариях", () => {
    const text = '# my settings\nmodel = "gpt"  # keep\n\n[tui]\ntheme = "dark"\n';

    const result = withTrust(text, trustEdit());

    expect(result.startsWith(text)).toBe(true);
  });

  it("сохраняет CRLF и новые строки пишет с ним же", () => {
    const text = 'model = "gpt"\r\n';

    const result = withTrust(text, trustEdit());

    expect(result.replaceAll("\r\n", "")).not.toContain("\n");
  });

  it("заменяет чужое значение доверия и хеш, оставляя остальные ключи таблицы", () => {
    const text = [
      `[projects."${PROJECT}"]`,
      'trust_level = "untrusted"',
      "note = 1",
      "",
      `[hooks.state."${STOP_KEY}"]`,
      'trusted_hash = "sha256:old"',
      "",
    ].join("\n");

    const result = withTrust(text, trustEdit());

    expect(parse(result)).toMatchObject({
      projects: { [PROJECT]: { trust_level: "trusted", note: 1 } },
      hooks: { state: { [STOP_KEY]: { trusted_hash: "sha256:bbb" } } },
    });
  });

  it("не трогает доверие, которое уже есть, и возвращает тот же текст", () => {
    const text = [
      `[projects."${PROJECT}"]`,
      'trust_level = "trusted"',
      `[hooks.state."${START_KEY}"]`,
      'trusted_hash = "sha256:aaa"',
      `[hooks.state."${STOP_KEY}"]`,
      'trusted_hash = "sha256:bbb"',
      "",
    ].join("\n");

    const result = withTrust(text, trustEdit());

    expect(result).toBe(text);
  });

  it("не пишет проект, если ключа проекта нет", () => {
    const result = withTrust("", { hooks: trustEdit().hooks });

    expect(parse(result)).not.toHaveProperty("projects");
  });

  it("правит таблицу, перед которой стоит многострочная строка с похожим заголовком", () => {
    const text = `note = """\n[projects."${PROJECT}"]\n"""\n`;

    const result = withTrust(text, trustEdit());

    expect(parse(result)).toMatchObject({
      note: `[projects."${PROJECT}"]\n`,
      projects: { [PROJECT]: { trust_level: "trusted" } },
    });
  });

  it("называет строки для ручной вставки, если таблица лежит во встроенной", () => {
    const text = `projects = { "${PROJECT}" = { trust_level = "untrusted" } }\n`;

    const problem = problemOf(() => withTrust(text, trustEdit()));

    expect(problem).toEqual({ kind: "layoutUnsupported", lines: trustLines(trustEdit()) });
  });

  it("называет строки для ручной вставки, если ключ записан через точки", () => {
    const text = `hooks.state."${STOP_KEY}".trusted_hash = "sha256:old"\n`;

    const problem = problemOf(() => withTrust(text, trustEdit()));

    expect(problem.kind).toBe("layoutUnsupported");
  });

  it("отвергает файл, который не TOML, до любой правки", () => {
    const act = () => withTrust("[unclosed", trustEdit());

    expect(problemOf(act).kind).toBe("notParsed");
  });

  it("берёт в кавычки путь с кавычкой и обратной косой", () => {
    const edit = { projectKey: 'C:\\work\\"odd"', hooks: [] };

    const result = withTrust("", edit);

    expect(parse(result)).toEqual({
      projects: { 'C:\\work\\"odd"': { trust_level: "trusted" } },
    });
  });
});

describe("withoutTrust", () => {
  it("возвращает файл байт в байт после withTrust", () => {
    const text = '# keep\nmodel = "gpt"\n\n[tui]\ntheme = "dark"\n';
    const trusted = withTrust(text, trustEdit());

    const result = withoutTrust(trusted, trustEdit());

    expect(result).toBe(text);
  });

  it("возвращает пустой файл после withTrust пустого", () => {
    const trusted = withTrust("", trustEdit());

    const result = withoutTrust(trusted, trustEdit());

    expect(result).toBe("");
  });

  it("возвращает файл с CRLF байт в байт", () => {
    const text = 'model = "gpt"\r\n\r\n[tui]\r\ntheme = "dark"\r\n';
    const trusted = withTrust(text, trustEdit());

    const result = withoutTrust(trusted, trustEdit());

    expect(result).toBe(text);
  });

  it("оставляет доверие, которое человек дал сам, без нашей отметки", () => {
    const text = `[projects."${PROJECT}"]\ntrust_level = "trusted"\n`;

    const result = withoutTrust(text, trustEdit());

    expect(result).toBe(text);
  });

  it("оставляет запись хука, если хеш не наш", () => {
    const text = `[hooks.state."${STOP_KEY}"]\ntrusted_hash = "sha256:theirs"\n`;

    const result = withoutTrust(text, trustEdit());

    expect(result).toBe(text);
  });

  it("убирает наши записи и оставляет чужие ключи в той же таблице", () => {
    const text = [
      `[projects."${PROJECT}"]`,
      `trust_level = "trusted" ${TRUST_MARK}`,
      "note = 1",
      "",
    ].join("\n");

    const result = withoutTrust(text, trustEdit());

    expect(parse(result)).toEqual({ projects: { [PROJECT]: { note: 1 } } });
  });

  it("отвергает файл, который не TOML", () => {
    const act = () => withoutTrust("[unclosed", trustEdit());

    expect(problemOf(act).kind).toBe("notParsed");
  });
});

describe("trustLines", () => {
  it("даёт таблицы, которые парсер читает как нужное доверие", () => {
    const lines = trustLines(trustEdit());

    expect(parse(lines)).toEqual(parse(withTrust("", trustEdit())));
  });

  it("без ключа проекта даёт только хуки", () => {
    const lines = trustLines({ hooks: trustEdit().hooks });

    expect(parse(lines)).not.toHaveProperty("projects");
  });
});
