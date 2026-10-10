import { describe, expect, it } from "vitest";
import { KitError } from "../errors.ts";
import { KIT_MESSAGES } from "../messages/catalog.ts";
import {
  contentHash,
  EMPTY_MANIFEST,
  MANIFEST_FILE,
  manifestText,
  parseManifest,
} from "./manifest.ts";

function errorOf(act: () => unknown): KitError {
  try {
    act();
  } catch (err) {
    if (err instanceof KitError) return err;

    throw err;
  }

  throw new Error("ожидалась KitError");
}

describe("contentHash", () => {
  it("не различает перевод строки Windows и Unix", () => {
    expect(contentHash("a\r\nb\r\n")).toBe(contentHash("a\nb\n"));
  });

  it("различает разный текст", () => {
    expect(contentHash("a")).not.toBe(contentHash("b"));
  });
});

describe("manifestText и parseManifest", () => {
  it("записывает и читает файлы и запреты, отсортировав их", () => {
    const text = manifestText({
      files: { "b.md": "sha256:2", "a.md": "sha256:1" },
      deny: ["z", "y"],
    });

    const manifest = parseManifest(text);

    expect(Object.keys(manifest.files)).toEqual(["a.md", "b.md"]);
    expect(manifest.deny).toEqual(["y", "z"]);
    expect(text.endsWith("\n")).toBe(true);
  });

  it("без файла даёт пустой манифест", () => {
    expect(parseManifest(undefined)).toBe(EMPTY_MANIFEST);
  });

  it("отвергает чужую версию схемы", () => {
    const act = () => parseManifest(JSON.stringify({ schemaVersion: 2 }));

    expect(errorOf(act).describe(KIT_MESSAGES.en)).toContain("unsupported schemaVersion 2");
  });

  it("отвергает не JSON с путём манифеста в тексте", () => {
    const act = () => parseManifest("{");

    expect(errorOf(act).describe(KIT_MESSAGES.en)).toContain(MANIFEST_FILE);
  });

  it("отвергает хеши не строками и запреты не списком строк", () => {
    const badFiles = () => parseManifest(JSON.stringify({ schemaVersion: 1, files: { a: 1 } }));
    const badDeny = () =>
      parseManifest(JSON.stringify({ schemaVersion: 1, settings: { deny: [1] } }));

    expect(errorOf(badFiles).describe(KIT_MESSAGES.en)).toContain("files must map paths to hashes");
    expect(errorOf(badDeny).describe(KIT_MESSAGES.en)).toContain(
      "settings.deny must be a list of strings",
    );
  });
});
