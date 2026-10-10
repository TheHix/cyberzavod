import { describe, expect, it } from "vitest";
import { patchPaths } from "./patch-paths.ts";

describe("patchPaths", () => {
  it("называет файлы всех заголовков патча по порядку, включая перенос", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: note.txt",
      "+hello",
      "*** Update File: src/a.ts",
      "*** Move to: src/b.ts",
      "@@",
      "-old",
      "+new",
      "*** Delete File: old.txt",
      "*** End Patch",
    ].join("\n");

    const paths = patchPaths(patch);

    expect(paths).toEqual(["note.txt", "src/a.ts", "src/b.ts", "old.txt"]);
  });

  it("не принимает за заголовок строку с таким текстом внутри изменения", () => {
    const patch = "*** Begin Patch\n*** Update File: a.ts\n+*** Add File: fake\n*** End Patch";

    const paths = patchPaths(patch);

    expect(paths).toEqual(["a.ts"]);
  });

  it("читает патч с переводами строк CRLF", () => {
    const patch = "*** Begin Patch\r\n*** Add File: note.txt\r\n+hi\r\n*** End Patch\r\n";

    const paths = patchPaths(patch);

    expect(paths).toEqual(["note.txt"]);
  });

  it("не находит файлов в тексте без патча", () => {
    const paths = patchPaths("ls -la");

    expect(paths).toEqual([]);
  });
});
