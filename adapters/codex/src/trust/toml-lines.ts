// Line-by-line view of a TOML file: just enough of the syntax to find table headers and keys and
// to change single lines without touching the rest of the file.

import { isDeepStrictEqual } from "node:util";
import { tomlKey } from "../generate/toml.ts";

const SEGMENT_SEPARATOR = ".";
const BARE_KEY_CHARACTER = /[A-Za-z0-9_-]/;
const ESCAPED_CHARACTERS: Readonly<Record<string, string>> = {
  b: "\b",
  t: "\t",
  n: "\n",
  f: "\f",
  r: "\r",
  '"': '"',
  "\\": "\\",
};
const SHORT_UNICODE_LENGTH = 4;
const LONG_UNICODE_LENGTH = 8;
const HEX_RADIX = 16;

/** A line of the file without its terminator, and the terminator. */
export interface Line {
  text: string;
  eol: string;
}

/** What the scanner knows about a line. */
export interface Scanned {
  /** The line starts a statement: it is not inside a multi-line string, array or inline table. */
  startsStatement: boolean;
  /** Key segments if the line is a table header. */
  header: string[] | undefined;
}

/** A table of the file: its header and the lines of its body. */
export interface Table {
  headerIndex: number;
  /** Index after the last body line. */
  end: number;
}

/**
 * Splits text into lines, keeping each line terminator.
 * @param {string} text File contents.
 * @returns {Line[]} Lines in order; joining them gives the text back.
 */
export function splitLines(text: string): Line[] {
  const parts = text.split(/(\r\n|\n)/);
  const lines: Line[] = [];

  for (let index = 0; index < parts.length; index += 2) {
    const lineText = parts[index] ?? "";
    const eol = parts[index + 1] ?? "";

    if (lineText !== "" || eol !== "") lines.push({ text: lineText, eol });
  }

  return lines;
}

/**
 * Joins lines back into text.
 * @param {readonly Line[]} lines Lines with their terminators.
 * @returns {string} The text.
 */
export function joinLines(lines: readonly Line[]): string {
  return lines.map(({ text, eol }) => `${text}${eol}`).join("");
}

/**
 * Line terminator the file uses: `\r\n` if it has one, `\n` otherwise.
 * @param {string} text File contents.
 * @returns {string} The terminator for new lines.
 */
export function eolOf(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function codePointOf(hex: string): string | undefined {
  const code = Number.parseInt(hex, HEX_RADIX);

  return Number.isNaN(code) ? undefined : String.fromCodePoint(code);
}

// Digits after `\u` and `\U`; 0 for any other escape.
function unicodeEscapeWidth(escape: string): number {
  if (escape === "u") return SHORT_UNICODE_LENGTH;
  if (escape === "U") return LONG_UNICODE_LENGTH;

  return 0;
}

// The escape sequence that starts at the backslash at `index`: the character it stands for and
// how many characters it takes; undefined if it is not a valid escape.
function escapeAt(text: string, index: number): { value: string; length: number } | undefined {
  const escape = text[index + 1] ?? "";
  const width = unicodeEscapeWidth(escape);
  const decoded =
    width === 0
      ? ESCAPED_CHARACTERS[escape]
      : codePointOf(text.slice(index + 2, index + 2 + width));

  return decoded === undefined ? undefined : { value: decoded, length: 2 + width };
}

// A quoted key segment from `start` (at the opening quote): its text and the index after the
// closing quote; undefined if the quote is not closed.
function quotedSegment(text: string, start: number): { value: string; next: number } | undefined {
  const quote = text[start];
  let value = "";
  let index = start + 1;

  while (index < text.length) {
    const character = text[index] ?? "";

    if (character === quote) return { value, next: index + 1 };

    const isEscape = quote === '"' && character === "\\";
    const piece = isEscape ? escapeAt(text, index) : { value: character, length: 1 };

    if (piece === undefined) return undefined;

    value += piece.value;
    index += piece.length;
  }

  return undefined;
}

function bareSegment(text: string, start: number): { value: string; next: number } | undefined {
  let index = start;

  while (BARE_KEY_CHARACTER.test(text[index] ?? "")) index += 1;

  return index === start ? undefined : { value: text.slice(start, index), next: index };
}

function skipSpaces(text: string, start: number): number {
  let index = start;

  while (text[index] === " " || text[index] === "\t") index += 1;

  return index;
}

// Segments of a table header such as `[a."b".'c']`; undefined if the line is not a header.
function headerSegments(trimmed: string): string[] | undefined {
  const isArrayTable = trimmed.startsWith("[[");
  const closing = isArrayTable ? "]]" : "]";
  const segments: string[] = [];
  let index = isArrayTable ? 2 : 1;

  for (;;) {
    index = skipSpaces(trimmed, index);

    const quote = trimmed[index];
    const segment =
      quote === '"' || quote === "'" ? quotedSegment(trimmed, index) : bareSegment(trimmed, index);

    if (segment === undefined) return undefined;

    segments.push(segment.value);
    index = skipSpaces(trimmed, segment.next);

    if (trimmed.startsWith(closing, index)) break;

    if (trimmed[index] !== SEGMENT_SEPARATOR) return undefined;

    index += 1;
  }

  const rest = trimmed.slice(skipSpaces(trimmed, index + closing.length));

  return rest === "" || rest.startsWith("#") ? segments : undefined;
}

/** Where a line leaves the scanner: inside a multi-line string or at some bracket depth. */
interface ScanState {
  multiline: MultilineDelimiter | undefined;
  depth: number;
}

type MultilineDelimiter = '"""' | "'''";

// One step inside a multi-line string: where the scan goes on and whether the string ended there.
function insideMultiline(
  text: string,
  index: number,
  delimiter: MultilineDelimiter,
): { next: number; isClosed: boolean } {
  const isBasic = delimiter === '"""';

  if (isBasic && text[index] === "\\") return { next: index + 2, isClosed: false };

  if (!text.startsWith(delimiter, index)) return { next: index + 1, isClosed: false };

  // Up to two more quotes right before the closing delimiter belong to the string.
  const quotes = isBasic ? /^"{0,2}/ : /^'{0,2}/;
  const extra = quotes.exec(text.slice(index + delimiter.length))?.[0].length ?? 0;

  return { next: index + delimiter.length + extra, isClosed: true };
}

// A string opened by the quote at `index`: where the scan goes on and the delimiter, if the string
// spans lines.
function afterOpeningQuote(
  text: string,
  index: number,
  quote: string,
): { next: number; multiline: MultilineDelimiter | undefined } {
  const triple = quote.repeat(3);

  if (text.startsWith(triple, index)) {
    return { next: index + triple.length, multiline: triple as MultilineDelimiter };
  }

  return { next: quotedSegment(text, index)?.next ?? text.length, multiline: undefined };
}

// Advances the state over one line outside of a header: strings, comments, brackets.
function scanned(text: string, state: ScanState): ScanState {
  let { multiline, depth } = state;
  let index = 0;

  while (index < text.length) {
    if (multiline !== undefined) {
      const step = insideMultiline(text, index, multiline);

      index = step.next;
      multiline = step.isClosed ? undefined : multiline;
      continue;
    }

    const character = text[index];

    if (character === "#") break;

    if (character === '"' || character === "'") {
      const opened = afterOpeningQuote(text, index, character);

      index = opened.next;
      multiline = opened.multiline;
      continue;
    }

    if (character === "[" || character === "{") depth += 1;
    if (character === "]" || character === "}") depth = Math.max(0, depth - 1);

    index += 1;
  }

  return { multiline, depth };
}

/**
 * Tells for every line whether it starts a statement and whether it is a table header.
 * @param {readonly Line[]} lines Lines of the file.
 * @returns {Scanned[]} One entry per line.
 */
export function scanLines(lines: readonly Line[]): Scanned[] {
  const result: Scanned[] = [];
  let state: ScanState = { multiline: undefined, depth: 0 };

  for (const { text } of lines) {
    const startsStatement = state.multiline === undefined && state.depth === 0;
    const trimmed = text.trimStart();
    const header = startsStatement && trimmed.startsWith("[") ? headerSegments(trimmed) : undefined;

    result.push({ startsStatement, header });

    if (header === undefined) state = scanned(text, state);
  }

  return result;
}

/**
 * Finds the table with the given header.
 * @param {readonly Scanned[]} scan Scan of the file.
 * @param {readonly string[]} segments Key segments of the header.
 * @returns {Table | undefined} The table, or undefined if the file has no such header.
 */
export function tableAt(scan: readonly Scanned[], segments: readonly string[]): Table | undefined {
  const headerIndex = scan.findIndex(({ header }) => isDeepStrictEqual(header, segments));

  if (headerIndex === -1) return undefined;

  const next = scan.findIndex(({ header }, index) => index > headerIndex && header !== undefined);

  return { headerIndex, end: next === -1 ? scan.length : next };
}

function keyLinePattern(key: string): RegExp {
  return new RegExp(`^\\s*(?:${key}|"${key}"|'${key}')\\s*=`);
}

/**
 * Finds the line of a key inside a table.
 * @param {readonly Line[]} lines Lines of the file.
 * @param {readonly Scanned[]} scan Scan of the file.
 * @param {Table} table Table to look in.
 * @param {string} key Key name.
 * @returns {number | undefined} Index of the line, or undefined if the table has no such key.
 */
export function keyLineIndex(
  lines: readonly Line[],
  scan: readonly Scanned[],
  table: Table,
  key: string,
): number | undefined {
  const pattern = keyLinePattern(key);

  for (let index = table.headerIndex + 1; index < table.end; index += 1) {
    if (scan[index]?.startsStatement === true && pattern.test(lines[index]?.text ?? "")) {
      return index;
    }
  }

  return undefined;
}

/**
 * Text of a table header.
 * @param {readonly string[]} segments Key segments.
 * @returns {string} Header such as `[a."b c"]`.
 */
export function headerText(segments: readonly string[]): string {
  return `[${segments.map(tomlKey).join(SEGMENT_SEPARATOR)}]`;
}

function withEndingNewline(lines: readonly Line[], eol: string): Line[] {
  const last = lines.at(-1);

  if (last === undefined || last.eol !== "") return [...lines];

  return [...lines.slice(0, -1), { ...last, eol }];
}

// A new table at the end of the file, set off by a blank line.
function withTableAppended(
  lines: readonly Line[],
  table: { segments: readonly string[]; line: string },
  eol: string,
): Line[] {
  const base = withEndingNewline(lines, eol);
  const separator: Line[] = base.length === 0 ? [] : [{ text: "", eol }];

  return [
    ...base,
    ...separator,
    { text: headerText(table.segments), eol },
    { text: table.line, eol },
  ];
}

/**
 * Sets a key line in a table: replaces the existing line or adds the line (and the table, if missing).
 * @param {readonly Line[]} lines Lines of the file.
 * @param {{ segments: readonly string[]; key: string; line: string }} target Table, key and the new line.
 * @param {readonly string[]} target.segments Key segments of the table header.
 * @param {string} target.key Key whose line is set.
 * @param {string} target.line The new line.
 * @param {string} eol Terminator for new lines.
 * @returns {Line[]} New lines.
 */
export function withLineSet(
  lines: readonly Line[],
  target: { segments: readonly string[]; key: string; line: string },
  eol: string,
): Line[] {
  const scan = scanLines(lines);
  const table = tableAt(scan, target.segments);

  if (table === undefined) return withTableAppended(lines, target, eol);

  const existing = keyLineIndex(lines, scan, table, target.key);

  if (existing !== undefined) {
    return lines.map((line, index) => (index === existing ? { ...line, text: target.line } : line));
  }

  const base = withEndingNewline(lines, eol);
  const at = table.headerIndex + 1;

  return [...base.slice(0, at), { text: target.line, eol }, ...base.slice(at)];
}

function isBlank(line: Line | undefined): boolean {
  return line !== undefined && line.text.trim() === "";
}

function withoutTable(lines: readonly Line[], table: Table): Line[] {
  // At the end of the file the blank line before the table only set it off, so it goes too; in the
  // middle that line is what separates the neighbors.
  const isLast = table.end >= lines.length;
  const hasBlankBefore = table.headerIndex > 0 && isBlank(lines[table.headerIndex - 1]);
  const start = isLast && hasBlankBefore ? table.headerIndex - 1 : table.headerIndex;

  return [...lines.slice(0, start), ...lines.slice(table.end)];
}

/**
 * Removes a key line from a table if the check says it is ours; a table left empty goes too.
 * @param {readonly Line[]} lines Lines of the file.
 * @param {{ segments: readonly string[]; key: string; isOurs: (text: string) => boolean }} target Table, key and the check of the line text.
 * @param {readonly string[]} target.segments Key segments of the table header.
 * @param {string} target.key Key whose line may be removed.
 * @param {(text: string) => boolean} target.isOurs Tells whether the line text is ours.
 * @returns {Line[]} New lines; the same lines if there was nothing to remove.
 */
export function withLineRemoved(
  lines: readonly Line[],
  target: { segments: readonly string[]; key: string; isOurs: (text: string) => boolean },
): Line[] {
  const scan = scanLines(lines);
  const table = tableAt(scan, target.segments);

  if (table === undefined) return [...lines];

  const at = keyLineIndex(lines, scan, table, target.key);

  if (at === undefined || !target.isOurs(lines[at]?.text ?? "")) return [...lines];

  const remaining = lines.filter((_line, index) => index !== at);
  const shrunk: Table = { headerIndex: table.headerIndex, end: table.end - 1 };
  const body = remaining.slice(shrunk.headerIndex + 1, shrunk.end);

  return body.every(isBlank) ? withoutTable(remaining, shrunk) : remaining;
}
