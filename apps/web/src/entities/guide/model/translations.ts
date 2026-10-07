import {
  byLocale,
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type Translated,
} from "@/shared/i18n/locale.ts";
import { GuideError, type GuideMeta } from "./guide.ts";

/** Гайд на одном языке: заголовок, описание и тело. */
export interface GuideTranslation<Body> {
  title: string;
  description: string;
  body: Body;
}

/** Гайд со всеми переводами: id и место в списке общие, тексты — на каждом языке сайта. */
export interface Guide<Body> {
  id: string;
  order: number;
  translations: Translated<GuideTranslation<Body>>;
}

/** Один файл гайда: проверенный frontmatter, язык из имени файла и тело. */
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
 * Собирает файлы гайдов в гайды: по одному файлу на каждый язык сайта с общим id. Сайт не
 * показывает гайд только на одном языке, поэтому непереведённый гайд — ошибка, как битый
 * frontmatter.
 * @param {readonly GuideFile<Body>[]} files Файлы гайдов всех языков.
 * @returns {Guide<Body>[]} Гайды в порядке первого появления id.
 * @throws {GuideError} Если у гайда нет перевода на язык сайта, есть два файла одного языка
 *   или у переводов разный `order`.
 */
export function pairTranslations<Body>(files: readonly GuideFile<Body>[]): Guide<Body>[] {
  return [...groupById(files)].map(([id, group]) => guideOf(id, group));
}
