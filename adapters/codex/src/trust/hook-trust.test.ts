import path from "node:path";
import { settingsText } from "@cyberzavod/adapter-kit";
import { describe, expect, it } from "vitest";
import { codexHooks, mergeHooksFile } from "../generate/hooks-config.ts";
import {
  hookTrustHash,
  hookTrustKey,
  isHookEvent,
  normalizedTimeout,
  ownHookTrust,
} from "./hook-trust.ts";

// Reference hashes are computed by an independent implementation of the Codex algorithm (Python:
// sha256 of the compact JSON with sorted keys), not by the code under test.
const STOP_HASH = "sha256:6d5b3fe4c2c3be61e17d96c2b910b78bc93c28144a70b2946d2dc019b236f691";
const PRE_TOOL_USE_HASH = "sha256:661134cd0fad9167f5cfdb2a896b9b9785ed51d3975b851622aa4cb295b12610";
const ASYNC_POST_TOOL_USE_HASH =
  "sha256:2603694b4102844e53b1184d4cf17953cbded67026c98125b0fe54bb2a1e3a18";
const SESSION_END_HASH = "sha256:544916fb302c3c2473535a6dfc740f276eeb7a7437e35c84c61507452b249b67";
const INTERRUPT_HASH = "sha256:62ff3f22d466214a78ee1c476871d1929af10e332f3b32e22b856433017c72fe";
const SESSION_START_HASH =
  "sha256:fe91ce7ceaaab9755df6d8f46967acf7c5e26cfe35034deac6c4a705a05105d0";

describe("hookTrustHash", () => {
  it("совпадает с эталоном для остановки со сроком и сообщением статуса", () => {
    const hash = hookTrustHash("Stop", undefined, {
      type: "command",
      command: "echo done",
      timeout: 30,
      statusMessage: "Checking…",
    });

    expect(hash).toBe(STOP_HASH);
  });

  it("совпадает с эталоном для события с matcher", () => {
    const hash = hookTrustHash("PreToolUse", "Bash|apply_patch", {
      type: "command",
      command: "guard",
    });

    expect(hash).toBe(PRE_TOOL_USE_HASH);
  });

  it("совпадает с эталоном для асинхронного обработчика", () => {
    const hash = hookTrustHash("PostToolUse", "Bash", {
      type: "command",
      command: "record",
      async: true,
    });

    expect(hash).toBe(ASYNC_POST_TOOL_USE_HASH);
  });

  it("ужимает срок у завершающих событий до трёх секунд", () => {
    const hash = hookTrustHash("SessionEnd", undefined, {
      type: "command",
      command: "bye",
      timeout: 10,
    });

    expect(hash).toBe(SESSION_END_HASH);
  });

  it("отбрасывает matcher у событий, где его нет", () => {
    const hash = hookTrustHash("Interrupt", "ignored", { type: "command", command: "x" });

    expect(hash).toBe(INTERRUPT_HASH);
  });

  it("совпадает с эталоном для простого обработчика", () => {
    const hash = hookTrustHash("SessionStart", undefined, { type: "command", command: "hi" });

    expect(hash).toBe(SESSION_START_HASH);
  });
});

describe("normalizedTimeout", () => {
  it("даёт десять минут по умолчанию и не меньше секунды", () => {
    expect([
      normalizedTimeout("Stop", undefined),
      normalizedTimeout("Stop", 0),
      normalizedTimeout("Stop", 45),
    ]).toEqual([600, 1, 45]);
  });

  it("у завершающих событий даёт секунду по умолчанию и не больше трёх", () => {
    expect([
      normalizedTimeout("SessionEnd", undefined),
      normalizedTimeout("Interrupt", 2),
      normalizedTimeout("SessionEnd", 99),
    ]).toEqual([1, 2, 3]);
  });
});

describe("hookTrustKey", () => {
  it("собирает ключ из файла, события и номеров группы и обработчика", () => {
    const key = hookTrustKey("/p/.codex/hooks.json", "UserPromptSubmit", { group: 1, handler: 2 });

    expect(key).toBe("/p/.codex/hooks.json:user_prompt_submit:1:2");
  });
});

describe("isHookEvent", () => {
  it("узнаёт события Codex и отвергает чужие", () => {
    expect([
      isHookEvent("Stop"),
      isHookEvent("PostToolUseFailure"),
      isHookEvent("toString"),
    ]).toEqual([true, false, false]);
  });
});

describe("ownHookTrust", () => {
  const root = path.resolve("/work/project");

  function hooksText(extra?: object): string {
    const base = mergeHooksFile({}, codexHooks("0.9.2"));
    const hooks = base.hooks as Record<string, unknown>;

    return settingsText(extra === undefined ? base : { ...base, hooks: { ...hooks, ...extra } });
  }

  it("даёт ключ и хеш на каждый свой обработчик, по одному на запись", () => {
    const trusts = ownHookTrust(root, hooksText());

    const keys = trusts.map(({ key }) => key.replace(`${root}${path.sep}.codex${path.sep}`, ""));

    expect(trusts).toHaveLength(9);
    expect(keys).toContain("hooks.json:stop:0:1");
    expect(keys).toContain("hooks.json:pre_tool_use:0:0");
    expect(new Set(trusts.map(({ hash }) => hash)).size).toBeGreaterThan(1);
  });

  it("считает чужие группы и обработчики в номерах, но не даёт для них записей", () => {
    const humanGroup = { hooks: [{ type: "command", command: "my-linter" }] };
    const base = mergeHooksFile({}, codexHooks("0.9.2"));
    const stopGroups = (base.hooks as { Stop: unknown[] }).Stop;
    const text = hooksText({ Stop: [humanGroup, ...stopGroups] });

    const trusts = ownHookTrust(root, text).filter(({ event }) => event === "Stop");

    expect(trusts.map(({ key }) => key.slice(key.indexOf("hooks.json")))).toEqual([
      "hooks.json:stop:1:0",
      "hooks.json:stop:1:1",
    ]);
  });

  it("пропускает события, которых Codex не знает", () => {
    const text = hooksText({ Whatever: [{ hooks: [{ type: "command", command: "x" }] }] });

    const trusts = ownHookTrust(root, text);

    expect(trusts).toHaveLength(9);
  });

  it("называет хук по команде, чтобы узнать тот же обработчик другой версии", () => {
    const trusts = ownHookTrust(root, hooksText()).filter(({ event }) => event === "Stop");

    expect(trusts.map(({ name }) => name)).toEqual(["record", "stop"]);
  });

  it("отклоняет группу без обработчиков ошибкой, а не приведением типа", () => {
    const text = hooksText({ Stop: [{ matcher: "x" }] });

    const act = () => ownHookTrust(root, text);

    expect(act).toThrow("hooks.Stop must be a list of groups with handlers");
  });
});
