import { describe, expect, it } from "vitest";
import { localeParam, localizedPath, pathWithoutLocale } from "./path.ts";

describe("localizedPath", () => {
  it.each([
    ["en", "/", "/"],
    ["ru", "/", "/ru/"],
    ["en", "/recordings/x/", "/recordings/x/"],
    ["ru", "/recordings/x/", "/ru/recordings/x/"],
  ] as const)("для языка %s путь %s даёт %s", (locale, path, expected) => {
    const result = localizedPath(locale, path);

    expect(result).toBe(expected);
  });
});

describe("pathWithoutLocale", () => {
  it.each([
    ["/ru/", "/"],
    ["/ru", "/"],
    ["/ru/recordings/x/", "/recordings/x/"],
    ["/recordings/x/", "/recordings/x/"],
    ["/", "/"],
    ["/russia/", "/russia/"],
    ["/recordings/ru/", "/recordings/ru/"],
  ])("превращает %s в %s", (pathname, expected) => {
    const result = pathWithoutLocale(pathname);

    expect(result).toBe(expected);
  });
});

describe("localeParam", () => {
  it("не даёт параметра для языка по умолчанию", () => {
    const param = localeParam("en");

    expect(param).toBeUndefined();
  });

  it("даёт код остальных языков", () => {
    const param = localeParam("ru");

    expect(param).toBe("ru");
  });
});
