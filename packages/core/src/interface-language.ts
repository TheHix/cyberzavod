// Языки, на которых CLI и адаптеры говорят с человеком и агентом. Тексты лежат в каталогах
// сообщений рядом с кодом, который их печатает: ядро хранит только коды языков и обобщённые типы.

/** Языки интерфейса: на каждом есть полный каталог сообщений. */
export const INTERFACE_LANGUAGES = ["en", "ru"] as const;

/** Язык интерфейса: один из `INTERFACE_LANGUAGES`. */
export type InterfaceLanguage = (typeof INTERFACE_LANGUAGES)[number];

/** Язык интерфейса, когда человек и окружение его не выбрали. */
export const DEFAULT_INTERFACE_LANGUAGE: InterfaceLanguage = "en";

/**
 * Каталог сообщений: полный набор текстов на каждом языке интерфейса. Язык без набора не
 * компилируется.
 */
export type MessageCatalog<Messages> = Readonly<Record<InterfaceLanguage, Messages>>;

/**
 * Текст, язык которого выбирается при показе: функция от набора сообщений. Ошибка для человека
 * хранит такую функцию, а не готовую строку.
 */
export type LocalizedText<Messages> = (messages: Messages) => string;

/**
 * Проверяет, что значение — код поддерживаемого языка интерфейса.
 * @param {string} value Проверяемое значение, например `ru`.
 * @returns {value is InterfaceLanguage} true, если на этом языке есть каталог сообщений.
 */
export function isInterfaceLanguage(value: string): value is InterfaceLanguage {
  return (INTERFACE_LANGUAGES as readonly string[]).includes(value);
}
