// Манифест сгенерированного: какие файлы и с каким содержимым записал генератор и какие запреты он
// сам дописал в настройки. По нему sync и disconnect отличают свой нетронутый файл от своего, но
// исправленного руками, а свой запрет — от такого же запрета человека.

import { createHash } from "node:crypto";
import { MARKER_DIRECTORY } from "@cyberzavod/storage";
import { GenerateError } from "./claude.ts";

/** Путь манифеста от корня проекта через `/`. */
export const MANIFEST_FILE = `${MARKER_DIRECTORY}/generated.json`;

/** Версия формата манифеста; не путать с версией CLI и harness. */
export const MANIFEST_SCHEMA_VERSION = 1;

const HASH_ALGORITHM = "sha256";

/** Манифест сгенерированного. */
export interface Manifest {
  /** Отпечаток содержимого каждого записанного файла по пути от корня через `/`. */
  files: Readonly<Record<string, string>>;
  /** Запреты, которые дописал генератор, а не человек: их убирает disconnect. */
  deny: readonly string[];
}

/** Пустой манифест: генератор в проекте ещё ничего не записал. */
export const EMPTY_MANIFEST: Manifest = { files: {}, deny: [] };

// Перевод строк при выписке из git на Windows не делает файл исправленным руками.
function withUnixNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/**
 * Отпечаток содержимого файла; `\r\n` и `\n` дают один отпечаток.
 * @param {string} text Содержимое файла.
 * @returns {string} Отпечаток вида `sha256:<hex>`.
 */
export function contentHash(text: string): string {
  const digest = createHash(HASH_ALGORITHM).update(withUnixNewlines(text)).digest("hex");

  return `${HASH_ALGORITHM}:${digest}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isObject(value) && Object.values(value).every((hash) => typeof hash === "string");
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((rule) => typeof rule === "string");
}

function unreadable(reason: string): GenerateError {
  return new GenerateError((messages) =>
    messages.errors.manifestNotParsed({ file: MANIFEST_FILE, reason }),
  );
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw unreadable((err as Error).message);
  }
}

/**
 * Разбирает текст манифеста.
 * @param {string | undefined} text Содержимое файла; undefined, если файла нет.
 * @returns {Manifest} Манифест; пустой, если файла нет.
 * @throws {GenerateError} Если текст не JSON, версия формата неизвестна или поля не того вида.
 */
export function parseManifest(text: string | undefined): Manifest {
  if (text === undefined) return EMPTY_MANIFEST;

  const raw = parseJson(text);

  if (!isObject(raw)) throw unreadable("not an object");
  if (raw.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw unreadable(`unsupported schemaVersion ${String(raw.schemaVersion)}`);
  }

  const { files = {}, settings = {} } = raw;

  if (!isStringRecord(files)) throw unreadable("files must map paths to hashes");

  const deny = isObject(settings) ? settings.deny : undefined;

  if (!isStringList(deny ?? [])) throw unreadable("settings.deny must be a list of strings");

  return { files, deny: deny === undefined ? [] : (deny as string[]) };
}

/**
 * Текст манифеста для записи на диск: пути и запреты по порядку, чтобы файл не менялся без нужды.
 * @param {Manifest} manifest Манифест.
 * @returns {string} JSON с переводом строки в конце.
 */
export function manifestText(manifest: Manifest): string {
  const paths = Object.keys(manifest.files).sort();
  const files = Object.fromEntries(paths.map((file) => [file, manifest.files[file]]));
  const deny = [...manifest.deny].sort();
  const document = { schemaVersion: MANIFEST_SCHEMA_VERSION, files, settings: { deny } };

  return `${JSON.stringify(document, null, 2)}\n`;
}
