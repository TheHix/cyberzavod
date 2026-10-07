// Карточка проекта: то, что сайт показывает о проекте, который собирает завод.

import { isLine, isObject } from "./guards.ts";
import { isRecordId } from "./record.ts";

/** Текст карточки на каждом языке витрины: язык — ключ, перевод — значение. */
export type ProjectText<Language extends string> = Readonly<Record<Language, string>>;

/**
 * Карточка проекта для сайта: название, описание и ссылки. Тексты — на каждом языке витрины,
 * ссылки общие. Как проект собирать — в `.cyberzavod/project.json` его репозитория, сюда это
 * не попадает.
 */
export interface Project<Language extends string> {
  /** Идентификатор проекта: тот же, что `SessionRecord.project`, и часть адреса страницы проекта. */
  id: string;
  name: ProjectText<Language>;
  /** Описание одной строкой на каждом языке. */
  description: ProjectText<Language>;
  /** Адрес репозитория, https. */
  repo?: string;
  /** Адрес сайта проекта, https. */
  website?: string;
}

/** Ошибка карточки проекта: она пришла извне и не прошла проверку. */
export class ProjectError extends Error {}

const SECURE_PROTOCOL = "https:";

function isSecureUrl(value: unknown): value is string {
  return (
    typeof value === "string" && URL.canParse(value) && new URL(value).protocol === SECURE_PROTOCOL
  );
}

// Необязательная ссылка: нет в карточке — нет и в результате, а не `undefined`.
function parseLink(
  raw: Record<string, unknown>,
  field: "repo" | "website",
): Pick<Project<string>, "repo" | "website"> {
  const value = raw[field];
  if (value === undefined) return {};
  if (!isSecureUrl(value)) {
    throw new ProjectError(`${field} должен быть адресом с https`);
  }
  return { [field]: value };
}

function parseText<Language extends string>(
  raw: unknown,
  field: "name" | "description",
  languages: readonly Language[],
): ProjectText<Language> {
  if (!isObject(raw)) {
    throw new ProjectError(`${field} должно быть объектом с переводами: ${languages.join(", ")}`);
  }
  const missing = languages.filter((language) => !isLine(raw[language]));
  if (missing.length > 0) {
    throw new ProjectError(
      `${field} на ${missing.join(", ")} должно быть непустой строкой без переводов строки`,
    );
  }
  return Object.fromEntries(
    languages.map((language) => [language, raw[language]]),
  ) as ProjectText<Language>;
}

/**
 * Проверяет карточку проекта, пришедшую извне, и возвращает её типизированной.
 * @param {unknown} raw Разобранный JSON карточки.
 * @param {readonly Language[]} languages Языки витрины: название и описание нужны на каждом.
 * @returns {Project<Language>} Проверенная карточка; неизвестные поля и языки отброшены.
 * @throws {ProjectError} Если карточка не соответствует формату или в ней нет перевода.
 */
export function parseProject<Language extends string>(
  raw: unknown,
  languages: readonly Language[],
): Project<Language> {
  if (!isObject(raw)) throw new ProjectError("карточка проекта должна быть объектом");
  const { id } = raw;
  if (!isRecordId(id)) throw new ProjectError("id должен состоять из букв, цифр, «_» и «-»");

  return {
    id,
    name: parseText(raw.name, "name", languages),
    description: parseText(raw.description, "description", languages),
    ...parseLink(raw, "repo"),
    ...parseLink(raw, "website"),
  };
}
