// Paragraphs of a message's full text are separated by a blank line.
const PARAGRAPH_BREAK = /\n\s*\n/;

/**
 * Splits a message's full text into paragraphs at blank lines.
 * @param {string} text Full message text.
 * @returns {string[]} Non-empty trimmed paragraphs; line breaks inside a paragraph stay.
 */
export function paragraphsOf(text: string): string[] {
  return text
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
}
