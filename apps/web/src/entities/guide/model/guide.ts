import { isLocale, LOCALES, type Locale } from "@/shared/i18n/locale.ts";

/** Guide header data: what the site shows in the list and in the page header. */
export interface GuideMeta {
  /** An id shared by all languages, from the file name: part of the page address. */
  id: string;
  title: string;
  /** One-line description: for the guide list and the page meta tag. */
  description: string;
  /** Place in the list: smaller numbers come first. */
  order: number;
}

/** What a guide's file name `<id>.<language>.md` says about it. */
export interface GuideFileName {
  id: string;
  locale: Locale;
}

/** Guide error: a file came from outside and failed the check. */
export class GuideError extends Error {}

const GUIDE_FILE_EXTENSION = ".md";
const GUIDE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LINE_BREAK = /[\r\n]/;

function isLine(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !LINE_BREAK.test(value);
}

/**
 * Parses a guide file path: the name is `<id>.<language>.md`. The id becomes part of the page
 * address, so it is lowercase Latin letters and digits separated by hyphens.
 * @param {string} file Guide file path, as `import.meta.glob` gives it.
 * @returns {GuideFileName} Guide id and file language.
 * @throws {GuideError} If it is not `.md`, has no site language, or the name does not fit a URL.
 */
export function guideFileOf(file: string): GuideFileName {
  const name = file.slice(file.lastIndexOf("/") + 1);

  if (!name.endsWith(GUIDE_FILE_EXTENSION)) {
    throw new GuideError(`гайд должен быть файлом ${GUIDE_FILE_EXTENSION}`);
  }

  const stem = name.slice(0, -GUIDE_FILE_EXTENSION.length);
  const localeStart = stem.lastIndexOf(".");
  const locale = stem.slice(localeStart + 1);

  if (localeStart === -1 || !isLocale(locale)) {
    throw new GuideError(
      `имя файла «${name}» должно заканчиваться языком сайта: .${LOCALES.join(".md, .")}.md`,
    );
  }

  const id = stem.slice(0, localeStart);

  if (!GUIDE_ID_PATTERN.test(id)) {
    throw new GuideError(
      `id гайда «${id}» должен состоять из строчных латинских букв и цифр через «-»`,
    );
  }

  return { id, locale };
}

/**
 * Checks a guide's frontmatter that came from outside and returns the header data.
 * @param {string} id Guide id from `guideFileOf`.
 * @param {unknown} frontmatter Parsed YAML from the start of the file.
 * @returns {GuideMeta} Checked data; unknown fields are dropped.
 * @throws {GuideError} If the frontmatter does not match the format.
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
