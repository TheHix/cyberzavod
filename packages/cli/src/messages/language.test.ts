import { describe, expect, it } from "vitest";
import { CommandError } from "../errors.ts";
import { CLI_MESSAGES } from "./catalog.ts";
import { extractLanguageFlag, languageOf, type Environment } from "./language.ts";

function thrownBy(act: () => unknown): unknown {
  try {
    act();
  } catch (err) {
    return err;
  }

  return undefined;
}

describe("languageOf", () => {
  it.each<[string, string | undefined, Environment, string]>([
    ["флаг важнее переменной и локали", "ru", { CYBERZAVOD_LANG: "en", LANG: "en_US.UTF-8" }, "ru"],
    ["переменная важнее локали", undefined, { CYBERZAVOD_LANG: "ru", LANG: "en_US.UTF-8" }, "ru"],
    [
      "неизвестная переменная пропускается",
      undefined,
      { CYBERZAVOD_LANG: "de", LANG: "ru_RU" },
      "ru",
    ],
    [
      "LC_ALL важнее LC_MESSAGES и LANG",
      undefined,
      { LC_ALL: "ru_RU", LC_MESSAGES: "en_US", LANG: "en_US" },
      "ru",
    ],
    ["LC_MESSAGES важнее LANG", undefined, { LC_MESSAGES: "ru_RU", LANG: "en_US" }, "ru"],
    ["пустой LC_ALL пропускается", undefined, { LC_ALL: "", LANG: "ru_RU" }, "ru"],
    ["LC_ALL=C не уступает LANG", undefined, { LC_ALL: "C", LANG: "ru_RU" }, "en"],
    ["ru_RU.UTF-8 — русский", undefined, { LANG: "ru_RU.UTF-8" }, "ru"],
    ["ru@euro — русский", undefined, { LANG: "ru@euro" }, "ru"],
    ["ru-RU — русский", undefined, { LANG: "ru-RU" }, "ru"],
    ["неподдерживаемая локаль — английский", undefined, { LANG: "de_DE.UTF-8" }, "en"],
    ["пустое окружение — английский", undefined, {}, "en"],
  ])("%s", (_name, flag, env, expected) => {
    const language = languageOf({ flag, env });

    expect(language).toBe(expected);
  });

  it("неподдерживаемый язык во флаге — ошибка команды", () => {
    const act = () => languageOf({ flag: "de", env: { LANG: "ru_RU" } });

    expect(act).toThrow(CommandError);
    expect(act).toThrow("language “de” is not supported: available are en, ru");
  });

  it("ошибка неподдерживаемого языка печатается на русском", () => {
    const error = thrownBy(() => languageOf({ flag: "de", env: {} }));

    expect((error as CommandError).describe(CLI_MESSAGES.ru)).toBe(
      "язык «de» не поддерживается: доступны en, ru",
    );
  });
});

describe("extractLanguageFlag", () => {
  it.each<[string, string[], string | undefined, string[]]>([
    ["без флага", ["status"], undefined, ["status"]],
    ["--lang ru", ["--lang", "ru", "status"], "ru", ["status"]],
    ["--lang=ru", ["--lang=ru", "status"], "ru", ["status"]],
    ["после команды", ["sync", "--check", "--lang", "en"], "en", ["sync", "--check"]],
    ["повтор — побеждает последний", ["--lang", "en", "--lang=ru"], "ru", []],
    [
      "после -- не трогается",
      ["note", "--", "--lang", "ru"],
      undefined,
      ["note", "--", "--lang", "ru"],
    ],
    [
      "до -- вынимается, после — нет",
      ["--lang", "ru", "note", "--", "--lang", "en"],
      "ru",
      ["note", "--", "--lang", "en"],
    ],
  ])("%s", (_name, argv, flag, rest) => {
    const extracted = extractLanguageFlag(argv);

    expect(extracted).toEqual({ flag, rest });
  });

  it.each([
    ["в конце без значения", ["status", "--lang"]],
    ["пустое значение", ["--lang="]],
    ["вместо значения другой флаг", ["--lang", "--check"]],
  ])("%s — ошибка команды", (_name, argv) => {
    const act = () => extractLanguageFlag(argv);

    expect(act).toThrow(CommandError);
    expect(act).toThrow(/--lang has no value/);
  });
});
