import { isLocale, LOCALES, type Locale } from "@/shared/i18n/locale.ts";

/** Заголовочные данные гайда: то, что сайт показывает в списке и в шапке страницы. */
export interface GuideMeta {
  /** Общий для всех языков id из имени файла: часть адреса страницы. */
  id: string;
  title: string;
  /** Описание одной строкой: для списка гайдов и мета-тега страницы. */
  description: string;
  /** Место в списке: меньшие числа идут раньше. */
  order: number;
}

/** Что говорит о гайде имя его файла `<id>.<язык>.md`. */
export interface GuideFileName {
  id: string;
  locale: Locale;
}

/** Ошибка гайда: файл пришёл извне и не прошёл проверку. */
export class GuideError extends Error {}

const GUIDE_FILE_EXTENSION = ".md";
const GUIDE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LINE_BREAK = /[\r\n]/;

function isLine(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !LINE_BREAK.test(value);
}

/**
 * Разбирает путь файла гайда: имя `<id>.<язык>.md`. Id становится частью адреса страницы,
 * поэтому он из строчных латинских букв и цифр через дефис.
 * @param {string} file Путь файла гайда, как его отдаёт `import.meta.glob`.
 * @returns {GuideFileName} Id гайда и язык файла.
 * @throws {GuideError} Если это не `.md`, нет языка сайта или имя не подходит для адреса.
 */
export function guideFileOf(file: string): GuideFileName {
  const name = file.slice(file.lastIndexOf("/") + 1);
  if (!name.endsWith(GUIDE_FILE_EXTENSION)) {
    throw new GuideError(`гайд должен быть файлом ${GUIDE_FILE_EXTENSION}`);
  }
  const stem = name.slice(0, -GUIDE_FILE_EXTENSION.length);
  const localeStart = stem.lastIndexOf(".");
  const id = stem.slice(0, Math.max(localeStart, 0));
  const locale = stem.slice(localeStart + 1);
  if (localeStart === -1 || !isLocale(locale)) {
    throw new GuideError(
      `имя файла «${name}» должно заканчиваться языком сайта: .${LOCALES.join(".md, .")}.md`,
    );
  }
  if (!GUIDE_ID_PATTERN.test(id)) {
    throw new GuideError(
      `id гайда «${id}» должен состоять из строчных латинских букв и цифр через «-»`,
    );
  }
  return { id, locale };
}

/**
 * Проверяет frontmatter гайда, пришедший извне, и возвращает заголовочные данные.
 * @param {string} id Id гайда из `guideFileOf`.
 * @param {unknown} frontmatter Разобранный YAML из начала файла.
 * @returns {GuideMeta} Проверенные данные; неизвестные поля отброшены.
 * @throws {GuideError} Если frontmatter не соответствует формату.
 */
export function parseGuideMeta(id: string, frontmatter: unknown): GuideMeta {
  if (typeof frontmatter !== "object" || frontmatter === null) {
    throw new GuideError("frontmatter гайда должен быть объектом");
  }
  const { title, description, order } = frontmatter as Record<string, unknown>;
  if (!isLine(title)) {
    throw new GuideError("title должен быть непустой строкой без переводов строки");
  }
  if (!isLine(description)) {
    throw new GuideError("description должно быть непустой строкой без переводов строки");
  }
  if (typeof order !== "number" || !Number.isInteger(order)) {
    throw new GuideError("order должен быть целым числом");
  }
  return { id, title, description, order };
}
