import {
  byLocale,
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type Translated,
} from "@/shared/i18n/locale.ts";
import { GuideError, type GuideMeta } from "./guide.ts";

/** A guide in one language: title, description and body. */
export interface GuideTranslation<Body> {
  title: string;
  description: string;
  body: Body;
}

/** A guide with all translations: id and list place are shared, texts are in every language. */
export interface Guide<Body> {
  id: string;
  order: number;
  translations: Translated<GuideTranslation<Body>>;
}

/** One guide file: checked frontmatter, the language from the file name, and the body. */
export interface GuideFile<Body> {
  meta: GuideMeta;
  locale: Locale;
  body: Body;
}

type FilesByLocale<Body> = Partial<Record<Locale, GuideFile<Body>>>;

function groupById<Body>(files: readonly GuideFile<Body>[]): Map<string, FilesByLocale<Body>> {
  const groups = new Map<string, FilesByLocale<Body>>();

  for (const file of files) {
    const group = groups.get(file.meta.id) ?? {};

    if (group[file.locale] !== undefined) {
      throw new GuideError(`у гайда «${file.meta.id}» два файла на языке ${file.locale}`);
    }

    groups.set(file.meta.id, { ...group, [file.locale]: file });
  }

  return groups;
}

function requireTranslation<Body>(
  id: string,
  locale: Locale,
  file: GuideFile<Body> | undefined,
): GuideFile<Body> {
  if (file === undefined) {
    throw new GuideError(`у гайда «${id}» нет перевода на язык ${locale}`);
  }

  return file;
}

function guideOf<Body>(id: string, group: FilesByLocale<Body>): Guide<Body> {
  const files = byLocale((locale) => requireTranslation(id, locale, group[locale]));
  const { order } = files[DEFAULT_LOCALE].meta;

  if (LOCALES.some((locale) => files[locale].meta.order !== order)) {
    throw new GuideError(`у переводов гайда «${id}» разный order`);
  }

  const translations = byLocale((locale) => {
    const { meta, body } = files[locale];

    return { title: meta.title, description: meta.description, body };
  });

  return { id, order, translations };
}

/**
 * Assembles guide files into guides: one file per site language with a shared id. The site does
 * not show a guide in only one language, so an untranslated guide is an error, like broken
 * frontmatter.
 * @param {readonly GuideFile<Body>[]} files Guide files in all languages.
 * @returns {Guide<Body>[]} Guides in order of each id's first appearance.
 * @throws {GuideError} If a guide lacks a translation into a site language, has two files in one
 *   language, or its translations have different `order`.
 */
export function pairTranslations<Body>(files: readonly GuideFile<Body>[]): Guide<Body>[] {
  return [...groupById(files)].map(([id, group]) => guideOf(id, group));
}
