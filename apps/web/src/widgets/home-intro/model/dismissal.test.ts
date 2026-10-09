import { describe, expect, it } from "vitest";
import { isIntroDismissed, rememberIntroDismissed, type DismissalStorage } from "./dismissal.ts";

function memoryStorage(): DismissalStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function blockedStorage(): DismissalStorage {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
}

describe("isIntroDismissed", () => {
  it("показывает блок при первом визите", () => {
    expect(isIntroDismissed(memoryStorage())).toBe(false);
  });

  it("помнит, что посетитель закрыл блок", () => {
    const storage = memoryStorage();

    rememberIntroDismissed(storage);

    expect(isIntroDismissed(storage)).toBe(true);
  });

  it("показывает блок, когда браузер закрыл хранилище", () => {
    expect(isIntroDismissed(blockedStorage())).toBe(false);
  });
});

describe("rememberIntroDismissed", () => {
  it("не падает, когда браузер закрыл хранилище", () => {
    const act = () => {
      rememberIntroDismissed(blockedStorage());
    };

    expect(act).not.toThrow();
  });
});
