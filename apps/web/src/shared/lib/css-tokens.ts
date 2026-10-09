// Site images (icons, link previews) are made at build time, where there is no
// `getComputedStyle`, so their colors are read straight from the text of tokens.css.

/** Where tokens are read from, as in `CSSStyleDeclaration`: an empty string for a missing token. */
export interface TokenSource {
  getPropertyValue(name: string): string;
}

const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g;

/**
 * Reads custom property declarations from CSS text. The first declaration of each token is taken,
 * the one from `:root`: overrides below (motion media queries) do not touch the colors.
 * @param {string} css Text of the stylesheet with the tokens.
 * @returns {TokenSource} Token values by name.
 */
export function readCssTokens(css: string): TokenSource {
  const values = new Map<string, string>();

  for (const [, name = "", value = ""] of css.matchAll(DECLARATION)) {
    if (!values.has(name)) values.set(name, value.trim());
  }

  return { getPropertyValue: (name) => values.get(name) ?? "" };
}
