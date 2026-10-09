import { atom } from "nanostores";
import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import { useHydratedStoreValue, useStoreValue } from "./use-store-value.ts";

describe("useStoreValue", () => {
  it("отдаёт новое значение стора", () => {
    const $count = atom(1);
    const count = createRoot(() => useStoreValue($count));

    $count.set(2);

    expect(count()).toBe(2);
  });

  it("не правит на месте прежнее значение — общие объекты остаются целы", () => {
    const shared = { x: 1 };
    const $point = atom(shared);
    const point = createRoot(() => useStoreValue($point));

    $point.set({ x: 2 });

    expect({ shared, current: point() }).toEqual({ shared: { x: 1 }, current: { x: 2 } });
  });
});

describe("useHydratedStoreValue", () => {
  it("до монтирования отдаёт значение сборки, даже если стор уже поменялся", () => {
    const $account = atom("author");

    const beforeMount = createRoot(() => useHydratedStoreValue($account, "loading")());

    expect(beforeMount).toBe("loading");
  });
});
