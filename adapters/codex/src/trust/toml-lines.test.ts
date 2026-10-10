import { describe, expect, it } from "vitest";
import {
  eolOf,
  headerText,
  joinLines,
  keyLineIndex,
  scanLines,
  splitLines,
  tableAt,
  withLineRemoved,
  withLineSet,
} from "./toml-lines.ts";

function textOf(lines: ReturnType<typeof splitLines>): string {
  return joinLines(lines);
}

describe("splitLines", () => {
  it("делит текст на строки с их переводами и собирается обратно", () => {
    const text = "a = 1\r\nb = 2\nc = 3";

    const lines = splitLines(text);

    expect(lines.map(({ eol }) => eol)).toEqual(["\r\n", "\n", ""]);
    expect(joinLines(lines)).toBe(text);
  });

  it("не даёт пустой строки после завершающего перевода", () => {
    const lines = splitLines("a = 1\n");

    expect(lines).toHaveLength(1);
  });
});

describe("eolOf", () => {
  it("берёт CRLF, если он есть в файле, иначе LF", () => {
    expect([eolOf("a\r\nb"), eolOf("a\nb"), eolOf("")]).toEqual(["\r\n", "\n", "\n"]);
  });
});

describe("scanLines", () => {
  it("разбирает заголовки с кавычками и точками внутри", () => {
    const lines = splitLines(
      ["[a.\"b.c\".'d e']", "[[arr]]", '[ spaced . "x" ] # note', "k = 1"].join("\n"),
    );

    const headers = scanLines(lines).map(({ header }) => header);

    expect(headers).toEqual([["a", "b.c", "d e"], ["arr"], ["spaced", "x"], undefined]);
  });

  it("не считает заголовком строку внутри многострочной строки", () => {
    const lines = splitLines(['text = """', "[projects.x]", '"""', "[real]"].join("\n"));

    const headers = scanLines(lines).map(({ header }) => header);

    expect(headers).toEqual([undefined, undefined, undefined, ["real"]]);
  });

  it("не считает заголовком строку внутри многострочного массива", () => {
    const lines = splitLines(["list = [", "  [1, 2],", "]", "[real]"].join("\n"));

    const headers = scanLines(lines).map(({ header }) => header);

    expect(headers).toEqual([undefined, undefined, undefined, ["real"]]);
  });

  it("закрывает многострочную строку с лишними кавычками перед закрытием", () => {
    const lines = splitLines(['text = """a""""', "[real]"].join("\n"));

    const headers = scanLines(lines).map(({ header }) => header);

    expect(headers).toEqual([undefined, ["real"]]);
  });

  it("пропускает экранированные кавычки в многострочной строке", () => {
    const lines = splitLines(['text = """a \\"""b', '"""', "[real]"].join("\n"));

    const headers = scanLines(lines).map(({ header }) => header);

    expect(headers).toEqual([undefined, undefined, ["real"]]);
  });

  it("не принимает за заголовок строку с мусором после скобки", () => {
    const lines = splitLines("[a] junk");

    const headers = scanLines(lines).map(({ header }) => header);

    expect(headers).toEqual([undefined]);
  });

  it("разбирает экранирование в ключе заголовка", () => {
    const lines = splitLines('["a\\tb\\u0041"]');

    const headers = scanLines(lines).map(({ header }) => header);

    expect(headers).toEqual([["a\tbA"]]);
  });
});

describe("tableAt", () => {
  it("находит таблицу и конец её тела до следующего заголовка", () => {
    const lines = splitLines(["x = 1", "[a]", "k = 1", "", "[b]", "k = 2"].join("\n"));

    const table = tableAt(scanLines(lines), ["a"]);

    expect(table).toEqual({ headerIndex: 1, end: 4 });
  });

  it("возвращает undefined, если такой таблицы нет", () => {
    const lines = splitLines("[a]\nk = 1");

    expect(tableAt(scanLines(lines), ["b"])).toBeUndefined();
  });
});

describe("keyLineIndex", () => {
  it("находит ключ в таблице, в том числе в кавычках", () => {
    const lines = splitLines(["[a]", "other = 1", '"key" = 2'].join("\n"));
    const scan = scanLines(lines);
    const table = tableAt(scan, ["a"]);

    const index = table === undefined ? undefined : keyLineIndex(lines, scan, table, "key");

    expect(index).toBe(2);
  });

  it("не находит ключ, который лежит в многострочной строке", () => {
    const lines = splitLines(["[a]", 'text = """', "key = 2", '"""'].join("\n"));
    const scan = scanLines(lines);
    const table = tableAt(scan, ["a"]);

    const index = table === undefined ? undefined : keyLineIndex(lines, scan, table, "key");

    expect(index).toBeUndefined();
  });
});

describe("headerText", () => {
  it("берёт в кавычки только сегменты, которым они нужны", () => {
    expect(headerText(["hooks", "state", "/p a/x:stop:0:0"])).toBe(
      'hooks.state."/p a/x:stop:0:0"'.replace(/^/, "[") + "]",
    );
  });
});

describe("withLineSet", () => {
  it("дописывает таблицу в конец файла, отделив её пустой строкой", () => {
    const lines = splitLines("a = 1\n");

    const result = withLineSet(lines, { segments: ["t"], key: "k", line: "k = 2" }, "\n");

    expect(textOf(result)).toBe("a = 1\n\n[t]\nk = 2\n");
  });

  it("не оставляет пустую строку в начале пустого файла", () => {
    const result = withLineSet([], { segments: ["t"], key: "k", line: "k = 2" }, "\n");

    expect(textOf(result)).toBe("[t]\nk = 2\n");
  });

  it("заменяет строку ключа, не трогая остальное", () => {
    const lines = splitLines("[t]\n# c\nk = 1 # old\nz = 3\n");

    const result = withLineSet(lines, { segments: ["t"], key: "k", line: "k = 2" }, "\n");

    expect(textOf(result)).toBe("[t]\n# c\nk = 2\nz = 3\n");
  });

  it("добавляет ключ сразу под заголовок существующей таблицы", () => {
    const lines = splitLines("[t]\nz = 3\n[u]\n");

    const result = withLineSet(lines, { segments: ["t"], key: "k", line: "k = 2" }, "\n");

    expect(textOf(result)).toBe("[t]\nk = 2\nz = 3\n[u]\n");
  });

  it("дописывает перевод строки к последней строке без перевода", () => {
    const lines = splitLines("a = 1");

    const result = withLineSet(lines, { segments: ["t"], key: "k", line: "k = 2" }, "\r\n");

    expect(textOf(result)).toBe("a = 1\r\n\r\n[t]\r\nk = 2\r\n");
  });
});

describe("withLineRemoved", () => {
  const isOurs = (text: string) => text.includes("ours");

  it("убирает свою строку и опустевшую таблицу вместе с пустой строкой перед ней", () => {
    const lines = splitLines('a = 1\n\n[t]\nk = "ours"\n\n[u]\nz = 1\n');

    const result = withLineRemoved(lines, { segments: ["t"], key: "k", isOurs });

    expect(textOf(result)).toBe("a = 1\n\n[u]\nz = 1\n");
  });

  it("убирает пустую строку перед последней таблицей, которой отделяли её от остального", () => {
    const lines = splitLines('a = 1\n\n[t]\nk = "ours"\n');

    const result = withLineRemoved(lines, { segments: ["t"], key: "k", isOurs });

    expect(textOf(result)).toBe("a = 1\n");
  });

  it("оставляет таблицу, если в ней есть другие ключи", () => {
    const lines = splitLines('[t]\nk = "ours"\nz = 1\n');

    const result = withLineRemoved(lines, { segments: ["t"], key: "k", isOurs });

    expect(textOf(result)).toBe("[t]\nz = 1\n");
  });

  it("не трогает чужую строку", () => {
    const lines = splitLines('[t]\nk = "theirs"\n');

    const result = withLineRemoved(lines, { segments: ["t"], key: "k", isOurs });

    expect(textOf(result)).toBe('[t]\nk = "theirs"\n');
  });
});
