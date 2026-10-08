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
  /**
   * Языки и инструменты проекта, как их пишут сами: «TypeScript», «Vite». Не переводятся и
   * показываются как есть, по порядку.
   */
  stack?: readonly string[];
}

/** Ошибка карточки проекта: она пришла извне и не прошла проверку. */
export class ProjectError extends Error {}

const SECURE_PROTOCOL = "https:";

// Стек — короткая подпись к проекту, а не список зависимостей.
const MAX_STACK_ITEMS = 6;

function isSecureUrl(value: unknown): value is string {
  if (typeof value !== "string" || !URL.canParse(value)) return false;

  return new URL(value).protocol === SECURE_PROTOCOL;
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

// Необязательный стек: нет в карточке — нет и в результате, как у ссылок.
function parseStack(raw: Record<string, unknown>): Pick<Project<string>, "stack"> {
  const { stack } = raw;

  if (stack === undefined) return {};

  const isList = Array.isArray(stack) && stack.length > 0 && stack.length <= MAX_STACK_ITEMS;

  if (!isList || !stack.every(isLine)) {
    throw new ProjectError(
      `stack должен быть списком из 1–${MAX_STACK_ITEMS} непустых строк без переводов строки`,
    );
  }

  return { stack: [...stack] };
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
    ...parseStack(raw),
  };
}
