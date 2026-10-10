import { RULES_TODO_MARK } from "@cyberzavod/core";
import { describe, expect, it } from "vitest";
import { KIT_MESSAGES } from "../messages/catalog.ts";
import { KitError } from "../errors.ts";
import { MARKDOWN_GENERATED_COMMENT } from "./marks.ts";
import { renderTemplate, templateValues } from "./template.ts";

function thrownBy(action: () => unknown): KitError {
  try {
    action();
  } catch (err) {
    return err as KitError;
  }

  throw new Error("the action did not throw");
}

describe("renderTemplate", () => {
  it("подставляет значения вместо {{имя}}, в том числе повторяющиеся", () => {
    const text = renderTemplate("{{a}} and {{b}} and {{a}}", { a: "1", b: "2" });

    expect(text).toBe("1 and 2 and 1");
  });

  it("отвергает неизвестную подстановку, называя её", () => {
    const act = () => renderTemplate("{{missing}}", {});

    expect(act).toThrow(KitError);
    expect(act).toThrow("{{missing}}");
  });

  it("описывает неизвестную подстановку по-русски", () => {
    const act = () => renderTemplate("{{missing}}", {});

    const err = thrownBy(act);

    expect(err.describe(KIT_MESSAGES.ru)).toContain("{{missing}}");
  });
});

describe("templateValues", () => {
  it("даёт подстановки отметки, CLI, каталогов захвата и заглушки", () => {
    const values = templateValues({ cli: "npx cyberzavod", capture: { raw: "r", drafts: "d" } });

    expect(values).toEqual({
      generated: MARKDOWN_GENERATED_COMMENT,
      cli: "npx cyberzavod",
      raw: "r",
      drafts: "d",
      todo: RULES_TODO_MARK,
    });
  });
});
