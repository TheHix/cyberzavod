import { describe, expect, it } from "vitest";
import { INTERVENTION_LABELS } from "@/shared/config/interventions.ts";
import { site } from "@/shared/config/site.ts";
import { FOREMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";
import { LOCALES } from "./locale.ts";
import { UI_TEXT } from "./ui-text.ts";

type TextFunction = (...parameters: string[]) => unknown;

interface TextLeaf {
  readonly path: string;
  readonly text: string;
  /** Пробы, подставленные в параметры: каждая должна дойти до текста. */
  readonly probes: readonly string[];
}

// На каждый параметр функции своя проба: по ним видно, какой параметр текст не использует.
function probesOf(textFunction: TextFunction): string[] {
  return Array.from({ length: textFunction.length }, (_, index) => `probe-${index + 1}`);
}

// Все строки дерева; функции вызываются с пробами, чтобы проверить и результат.
function textLeaves(value: unknown, path: string): TextLeaf[] {
  if (typeof value === "string") return [{ path, text: value, probes: [] }];
  if (typeof value === "function") {
    const probes = probesOf(value as TextFunction);
    return [{ path, text: String((value as TextFunction)(...probes)), probes }];
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => textLeaves(child, `${path}.${key}`));
  }
  return [{ path, text: String(value), probes: [] }];
}

function leafCases(value: unknown, path: string): [string, TextLeaf][] {
  return textLeaves(value, path).map((leaf) => [leaf.path, leaf]);
}

describe("UI_TEXT", () => {
  it.each(leafCases(UI_TEXT, "UI_TEXT"))("не оставляет пустой строку %s", (_path, leaf) => {
    expect(leaf.text.trim()).not.toBe("");
  });

  it.each(leafCases(UI_TEXT, "UI_TEXT"))("использует в тексте все параметры %s", (_path, leaf) => {
    const missing = leaf.probes.filter((probe) => !leaf.text.includes(probe));

    expect(missing).toEqual([]);
  });

  it.each(
    Object.entries(UI_TEXT).flatMap(([group, entries]) =>
      Object.entries(entries).map(([key, translated]) => [`${group}.${key}`, translated] as const),
    ),
  )("описывает %s на каждом языке", (_path, translated) => {
    expect(Object.keys(translated).sort()).toEqual([...LOCALES].sort());
  });

  it("подставляет параметры в тексты с параметрами", () => {
    const texts = textLeaves(UI_TEXT.speech.humanTo, "humanTo");

    expect(texts.map((leaf) => leaf.text)).toEqual(["human → probe-1", "человек → probe-1"]);
  });
});

describe.each([
  ["STAGE_LABELS", STAGE_LABELS],
  ["FOREMAN_LABEL", FOREMAN_LABEL],
  ["INTERVENTION_LABELS", INTERVENTION_LABELS],
  ["site", { name: site.name, description: site.description }],
] as const)("%s", (name, labels) => {
  it.each(leafCases(labels, name))("не оставляет пустой строку %s", (_path, leaf) => {
    expect(leaf.text.trim()).not.toBe("");
  });
});
