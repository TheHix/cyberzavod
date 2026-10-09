// Manifest of generated output: which files the generator wrote and with what contents, and which
// deny rules it added to the settings itself. With it sync and disconnect tell their own untouched
// file from their own hand-edited one, and their own deny rule from the same rule by the human.

import { createHash } from "node:crypto";
import { MARKER_DIRECTORY } from "@cyberzavod/storage";
import { GenerateError } from "./claude.ts";

/** Manifest path from the project root with `/`. */
export const MANIFEST_FILE = `${MARKER_DIRECTORY}/generated.json`;

/** Manifest format version; not to be confused with the CLI and harness version. */
export const MANIFEST_SCHEMA_VERSION = 1;

const HASH_ALGORITHM = "sha256";

/** Manifest of generated output. */
export interface Manifest {
  /** Content fingerprint of each written file by path from the root with `/`. */
  files: Readonly<Record<string, string>>;
  /** Deny rules added by the generator, not the human: disconnect removes them. */
  deny: readonly string[];
}

/** Empty manifest: the generator has not written anything in the project yet. */
export const EMPTY_MANIFEST: Manifest = { files: {}, deny: [] };

// Line ending conversion on git checkout on Windows does not make a file hand-edited.
function withUnixNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/**
 * Fingerprint of file contents; `\r\n` and `\n` give the same fingerprint.
 * @param {string} text File contents.
 * @returns {string} Fingerprint of the form `sha256:<hex>`.
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
 * Parses the manifest text.
 * @param {string | undefined} text File contents; undefined if there is no file.
 * @returns {Manifest} The manifest; empty if there is no file.
 * @throws {GenerateError} If the text is not JSON, the format version is unknown, or fields have
 *   the wrong shape.
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
 * Manifest text to write to disk: paths and deny rules in order, so the file does not change
 * needlessly.
 * @param {Manifest} manifest Manifest.
 * @returns {string} JSON with a trailing newline.
 */
export function manifestText(manifest: Manifest): string {
  const paths = Object.keys(manifest.files).sort();
  const files = Object.fromEntries(paths.map((file) => [file, manifest.files[file]]));
  const deny = [...manifest.deny].sort();
  const document = { schemaVersion: MANIFEST_SCHEMA_VERSION, files, settings: { deny } };

  return `${JSON.stringify(document, null, 2)}\n`;
}
