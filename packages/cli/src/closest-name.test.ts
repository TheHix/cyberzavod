import { describe, expect, it } from "vitest";
import { closestName, editDistance } from "./closest-name.ts";

describe("editDistance", () => {
  it.each([
    ["пустые строки", "", "", 0],
    ["пустая и непустая", "", "abc", 3],
    ["непустая и пустая", "abc", "", 3],
    ["совпадение", "status", "status", 0],
    ["одна замена", "stats", "state", 1],
    ["kitten и sitting", "kitten", "sitting", 3],
  ])("%s", (_name, left, right, expected) => {
    const distance = editDistance(left, right);

    expect(distance).toBe(expected);
  });
});

describe("closestName", () => {
  const candidates = ["init", "status", "share", "sync"] as const;

  it("возвращает ближайшее имя", () => {
    const name = closestName("stats", candidates);

    expect(name).toBe("status");
  });

  it("не подсказывает имя дальше порога", () => {
    const name = closestName("deploy", candidates);

    expect(name).toBeUndefined();
  });

  it("при равном расстоянии выбирает первое имя", () => {
    const name = closestName("ab", ["ac", "ad"]);

    expect(name).toBe("ac");
  });

  it("не учитывает регистр", () => {
    const name = closestName("STATUS", candidates);

    expect(name).toBe("status");
  });
});
