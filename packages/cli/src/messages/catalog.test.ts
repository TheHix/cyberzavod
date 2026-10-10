import { INTERFACE_LANGUAGES } from "@cyberzavod/core";
import { CLAUDE_MESSAGES } from "@cyberzavod/adapter-claude";
import { CODEX_MESSAGES } from "@cyberzavod/adapter-codex";
import { KIT_MESSAGES } from "@cyberzavod/adapter-kit";
import { describe, expect, it } from "vitest";
import { CLI_MESSAGES } from "./catalog.ts";

type Catalog = Readonly<Record<string, unknown>>;

// Catalog key paths: a function counts as a leaf, just like a string.
function pathsOf(messages: unknown, prefix = ""): string[] {
  if (typeof messages !== "object" || messages === null) return [prefix];

  return Object.entries(messages).flatMap(([key, value]) =>
    pathsOf(value, prefix === "" ? key : `${prefix}.${key}`),
  );
}

function stringsOf(messages: unknown): string[] {
  if (typeof messages === "string") return [messages];
  if (typeof messages !== "object" || messages === null) return [];

  return Object.values(messages).flatMap(stringsOf);
}

describe.each<[string, Catalog]>([
  ["CLI_MESSAGES", CLI_MESSAGES],
  ["CLAUDE_MESSAGES", CLAUDE_MESSAGES],
  ["CODEX_MESSAGES", CODEX_MESSAGES],
  ["KIT_MESSAGES", KIT_MESSAGES],
])("%s", (_name, catalog) => {
  it("содержит набор сообщений на каждом языке интерфейса", () => {
    const languages = Object.keys(catalog);

    expect(languages).toEqual([...INTERFACE_LANGUAGES]);
  });

  it.each(INTERFACE_LANGUAGES)(
    "на языке %s называет те же ключи, что и на английском",
    (language) => {
      const paths = pathsOf(catalog[language]).sort();
      const englishPaths = pathsOf(catalog.en).sort();

      expect(paths).toEqual(englishPaths);
    },
  );

  it.each(INTERFACE_LANGUAGES)("на языке %s не оставляет пустых строк", (language) => {
    const texts = stringsOf(catalog[language]);

    expect(texts.filter((text) => text.trim() === "")).toEqual([]);
  });
});
