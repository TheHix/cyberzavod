import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { tomlKey, tomlMultilineString, tomlString } from "./toml.ts";

describe("tomlString", () => {
  it("экранирует кавычки, обратную косую и управляющие символы", () => {
    const text = 'say "hi"\\\n\t\u0001';

    const value = parse(`key = ${tomlString(text)}`);

    expect(value).toEqual({ key: text });
  });

  it("оставляет русский текст как есть", () => {
    const quoted = tomlString("Привет");

    expect(quoted).toBe('"Привет"');
  });
});

describe("tomlMultilineString", () => {
  it("хранит текст читаемым, с переводами строк", () => {
    const text = "first\nsecond\tcolumn";

    const quoted = tomlMultilineString(text);

    expect(quoted).toBe(`"""\nfirst\nsecond\tcolumn\n"""`);
  });

  it("разбирается обратно в тот же текст с завершающим переводом строки, если в нём тройные кавычки и обратная косая", () => {
    const text = 'a """ b \\ c "" d """"\nend"';

    const value = parse(`key = ${tomlMultilineString(text)}`);

    expect(value).toEqual({ key: `${text}\n` });
  });

  it("экранирует управляющие символы, кроме табуляции и перевода строки", () => {
    const text = "bell\u0007\u007f";

    const value = parse(`key = ${tomlMultilineString(text)}`);

    expect(value).toEqual({ key: `${text}\n` });
  });
});

describe("tomlKey", () => {
  it("оставляет простой ключ без кавычек", () => {
    expect(tomlKey("trust_level-1")).toBe("trust_level-1");
  });

  it("берёт в кавычки ключ с точкой, пробелом и слешем", () => {
    const key = "/home/me/my project.v2";

    const value = parse(`[${tomlKey(key)}]\nx = 1`);

    expect(value).toEqual({ [key]: { x: 1 } });
  });
});
