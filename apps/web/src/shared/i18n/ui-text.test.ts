import { describe, expect, it } from "vitest";
import { INTERVENTION_LABELS } from "@/shared/config/interventions.ts";
import { LOGO_LINES, LOGO_SHORT_LINES } from "@/shared/config/logo.ts";
import { site } from "@/shared/config/site.ts";
import { FOREMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";
import { LOCALES } from "./locale.ts";
import { UI_TEXT } from "./ui-text.ts";

type TextFunction = (...parameters: string[]) => unknown;

interface TextLeaf {
  readonly path: string;
  readonly text: string;
  /** Probes passed as parameters: each must reach the text. */
  readonly probes: readonly string[];
}

// Each function parameter gets its own probe: they show which parameter the text does not use.
function probesOf(textFunction: TextFunction): string[] {
  return Array.from({ length: textFunction.length }, (_, index) => `probe-${index + 1}`);
}

// All strings in the tree; functions are called with probes so their result is checked too.
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

function translatedTexts(): (readonly [string, object])[] {
  return Object.entries(UI_TEXT).flatMap(([group, entries]) =>
    Object.entries(entries).map(([key, translated]) => [`${group}.${key}`, translated] as const),
  );
}

describe("UI_TEXT", () => {
  it.each(leafCases(UI_TEXT, "UI_TEXT"))("не оставляет пустой строку %s", (_path, leaf) => {
    expect(leaf.text.trim()).not.toBe("");
  });

  it.each(leafCases(UI_TEXT, "UI_TEXT"))("использует в тексте все параметры %s", (_path, leaf) => {
    const missing = leaf.probes.filter((probe) => !leaf.text.includes(probe));

    expect(missing).toEqual([]);
  });

  it.each(translatedTexts())("описывает %s на каждом языке", (_path, translated) => {
    const locales = Object.keys(translated).sort();

    expect(locales).toEqual([...LOCALES].sort());
  });

  it("подставляет параметры в тексты с параметрами", () => {
    const texts = textLeaves(UI_TEXT.speech.humanTo, "humanTo");

    expect(texts.map((leaf) => leaf.text)).toEqual(["human → probe-1", "человек → probe-1"]);
  });
});

describe.each([
  ["STAGE_LABELS", STAGE_LABELS],
  ["FOREMAN_LABEL", FOREMAN_LABEL],
  ["LOGO_LINES", LOGO_LINES],
  ["LOGO_SHORT_LINES", LOGO_SHORT_LINES],
  ["INTERVENTION_LABELS", INTERVENTION_LABELS],
  ["site", { name: site.name, description: site.description }],
] as const)("%s", (name, labels) => {
  it.each(leafCases(labels, name))("не оставляет пустой строку %s", (_path, leaf) => {
    expect(leaf.text.trim()).not.toBe("");
  });
});
