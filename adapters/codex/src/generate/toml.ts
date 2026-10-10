// TOML text for the generated files. Only values are written: strings and keys.

const BARE_KEY = /^[A-Za-z0-9_-]+$/;
const ESCAPES: Readonly<Record<string, string>> = {
  "\\": "\\\\",
  '"': '\\"',
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
};
const HEX_RADIX = 16;
const UNICODE_ESCAPE_WIDTH = 4;
const FIRST_PRINTABLE_CODE = 0x20;
const DELETE_CODE = 0x7f;
const TAB_CODE = 0x09;
const NEWLINE_CODE = 0x0a;
const MULTILINE_QUOTES = '"""';
const ESCAPED_MULTILINE_QUOTES = '""\\"';

function isControl(character: string): boolean {
  const code = character.charCodeAt(0);

  return code < FIRST_PRINTABLE_CODE || code === DELETE_CODE;
}

function escaped(character: string): string {
  const known = ESCAPES[character];

  if (known !== undefined) return known;

  const code = character.charCodeAt(0).toString(HEX_RADIX).padStart(UNICODE_ESCAPE_WIDTH, "0");

  return `\\u${code}`;
}

function withEscapes(text: string, isEscaped: (character: string) => boolean): string {
  return [...text]
    .map((character) => (isEscaped(character) ? escaped(character) : character))
    .join("");
}

/**
 * TOML basic string.
 * @param {string} text Any text.
 * @returns {string} The text in double quotes with `\`, `"` and control characters escaped.
 */
export function tomlString(text: string): string {
  const inside = withEscapes(text, (c) => c === "\\" || c === '"' || isControl(c));

  return `"${inside}"`;
}

/**
 * TOML multi-line basic string: the text stays readable in the file.
 * @param {string} text Any text.
 * @returns {string} The text between `"""` lines, with `\`, runs of `"""` and control characters
 *   other than tab and newline escaped.
 */
export function tomlMultilineString(text: string): string {
  const isKept = (c: string) => c.charCodeAt(0) === TAB_CODE || c.charCodeAt(0) === NEWLINE_CODE;
  const inside = withEscapes(text, (c) => c === "\\" || (isControl(c) && !isKept(c)));
  const safe = inside.replaceAll(MULTILINE_QUOTES, ESCAPED_MULTILINE_QUOTES);

  return `"""\n${safe}\n"""`;
}

/**
 * TOML key segment.
 * @param {string} segment Key part between dots.
 * @returns {string} The segment bare if it may be, otherwise a quoted string.
 */
export function tomlKey(segment: string): string {
  return BARE_KEY.test(segment) ? segment : tomlString(segment);
}
