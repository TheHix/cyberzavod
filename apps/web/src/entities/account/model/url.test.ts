import { describe, expect, it } from "vitest";
import {
  avatarUrl,
  cabinetUrl,
  isSignInFailed,
  pathWithoutSignInResult,
  signInUrl,
} from "./url.ts";

describe("signInUrl", () => {
  it("передаёт API путь возврата с параметрами", () => {
    const url = signInUrl("/ru/gallery/?user=alice");

    expect(url).toBe("/api/auth/github/login?return=%2Fru%2Fgallery%2F%3Fuser%3Dalice");
  });
});

describe("pathWithoutSignInResult", () => {
  it.each([
    ["/", "?login=failed", "/"],
    ["/gallery/", "?user=alice&login=failed", "/gallery/?user=alice"],
    ["/r/", "?id=abc", "/r/?id=abc"],
    ["/ru/me/", "", "/ru/me/"],
  ])("убирает отметку о входе из %s%s", (pathname, search, expected) => {
    const path = pathWithoutSignInResult(pathname, search);

    expect(path).toBe(expected);
  });
});

describe("isSignInFailed", () => {
  it.each([
    ["?login=failed", true],
    ["?user=alice&login=failed", true],
    ["?login=ok", false],
    ["", false],
  ])("читает отметку о неудачном входе в %j", (search, expected) => {
    const failed = isSignInFailed(search);

    expect(failed).toBe(expected);
  });
});

describe("avatarUrl", () => {
  it("берёт аватар у GitHub", () => {
    const url = avatarUrl("alice");

    expect(url).toBe("https://github.com/alice.png?size=64");
  });
});

describe("cabinetUrl", () => {
  it.each([
    ["en", "/me/"],
    ["ru", "/ru/me/"],
  ] as const)("ведёт в кабинет на языке %s", (locale, expected) => {
    const url = cabinetUrl(locale);

    expect(url).toBe(expected);
  });
});
