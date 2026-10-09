// Languages in which the CLI and adapters talk to the human and the agent. Texts live in message
// catalogs next to the code that prints them: the core keeps only language codes and generic types.

/** Interface languages: each has a complete message catalog. */
export const INTERFACE_LANGUAGES = ["en", "ru"] as const;

/** Interface language: one of `INTERFACE_LANGUAGES`. */
export type InterfaceLanguage = (typeof INTERFACE_LANGUAGES)[number];

/** Interface language when neither the human nor the environment chose one. */
export const DEFAULT_INTERFACE_LANGUAGE: InterfaceLanguage = "en";

/**
 * Message catalog: a complete set of texts in each interface language. A language without a set
 * does not compile.
 */
export type MessageCatalog<Messages> = Readonly<Record<InterfaceLanguage, Messages>>;

/**
 * Text whose language is chosen when it is shown: a function of the message set. An error for the
 * human stores such a function rather than a ready string.
 */
export type LocalizedText<Messages> = (messages: Messages) => string;

/**
 * Checks that a value is the code of a supported interface language.
 * @param {string} value The value to check, for example `ru`.
 * @returns {value is InterfaceLanguage} true if there is a message catalog in this language.
 */
export function isInterfaceLanguage(value: string): value is InterfaceLanguage {
  return (INTERFACE_LANGUAGES as readonly string[]).includes(value);
}
