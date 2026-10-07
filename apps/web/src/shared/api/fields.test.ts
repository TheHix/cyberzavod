import { describe, expect, it } from "vitest";
import { ApiResponseError } from "./errors.ts";
import { arrayAt, booleanAt, countAt, objectAt, stringAt } from "./fields.ts";

describe("objectAt", () => {
  it("принимает объект", () => {
    const object = objectAt({ login: "alice" }, "ответ");

    expect(object).toEqual({ login: "alice" });
  });

  it.each([null, [], "alice", 3])("отклоняет %j", (value) => {
    const act = () => objectAt(value, "ответ");

    expect(act).toThrow(ApiResponseError);
  });
});

describe("stringAt", () => {
  it("читает строку", () => {
    const value = stringAt({ login: "alice" }, "login", "галерея");

    expect(value).toBe("alice");
  });

  it("называет поле и место, если это не строка", () => {
    const act = () => stringAt({ login: 1 }, "login", "галерея");

    expect(act).toThrow("галерея: login не строка");
  });
});

describe("countAt", () => {
  it("читает неотрицательное целое", () => {
    const value = countAt({ count: 0 }, "count", "этап");

    expect(value).toBe(0);
  });

  it.each([-1, 1.5, "3", undefined])("отклоняет %j", (count) => {
    const act = () => countAt({ count }, "count", "этап");

    expect(act).toThrow(ApiResponseError);
  });
});

describe("booleanAt", () => {
  it("читает true и false", () => {
    const value = booleanAt({ galleryPublic: false }, "galleryPublic", "запись");

    expect(value).toBe(false);
  });

  it("отклоняет строку", () => {
    const act = () => booleanAt({ galleryPublic: "false" }, "galleryPublic", "запись");

    expect(act).toThrow(ApiResponseError);
  });
});

describe("arrayAt", () => {
  it("читает массив", () => {
    const value = arrayAt({ galleries: [1, 2] }, "galleries", "ответ");

    expect(value).toEqual([1, 2]);
  });

  it("отклоняет объект на месте массива", () => {
    const act = () => arrayAt({ galleries: {} }, "galleries", "ответ");

    expect(act).toThrow(ApiResponseError);
  });
});
