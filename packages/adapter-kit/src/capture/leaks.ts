// A safety net before publishing: what must not reach the site but easily slips through
// while prompts are edited. The main check is the human; a new sign is a new row in the table.

/** A kind of thing that must not reach the site; the message catalog names it to the human. */
export type LeakKind =
  | "ip-address"
  | "ipv6-address"
  | "email"
  | "server-login"
  | "token"
  | "url-password"
  | "private-key"
  | "user-path";

const LEAK_PATTERNS: readonly { kind: LeakKind; pattern: RegExp }[] = [
  // Local 127.x and 0.0.0.0 reveal nothing about servers, so they are skipped.
  { kind: "ip-address", pattern: /\b(?!127\.|0\.0\.0\.0\b)\d{1,3}(?:\.\d{1,3}){3}\b/ },
  // Empty groups are the shorthand form `2001:db8::1`.
  { kind: "ipv6-address", pattern: /\b(?:[\da-f]{0,4}:){3,7}[\da-f]{1,4}\b/i },
  // A top-level domain made of letters: `vite@8.3.2` and `action@v4.6.0` are versions, not
  // addresses.
  { kind: "email", pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}\b/i },
  {
    kind: "server-login",
    pattern: /\b(?:root|admin|deploy|ubuntu|debian)@[\w.-]+/,
  },
  {
    kind: "token",
    pattern: /\b(?:gh[pousr]_|github_pat_|sk-|sk_live_|xox[abp]-|AKIA|AIza)[\w-]{8,}/,
  },
  // An npm token has exactly 36 characters after the prefix: `npm_config_store_dir` is a variable,
  // not a token.
  { kind: "token", pattern: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { kind: "url-password", pattern: /\b[a-z][\w+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i },
  // JWT: two base64url parts joined by a dot are a token too.
  { kind: "token", pattern: /\beyJ[\w-]{8,}\.[\w-]{8,}\./ },
  { kind: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  // A path at the start of a word, not part of an address like `example.com/home/docs`.
  { kind: "user-path", pattern: /(?<![\w.])\/(?:Users|home)\/[\w.-]+/ },
];

/**
 * Looks for anything resembling an address, a key or a personal path in text to be published.
 * @param {string} text Text that will reach the site.
 * @returns {LeakKind[]} Kinds found, without repeats; an empty list if nothing is found.
 */
export function findLeaks(text: string): LeakKind[] {
  const kinds = LEAK_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ kind }) => kind);

  return [...new Set(kinds)];
}
