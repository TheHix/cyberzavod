// Карточка проекта: то, что сайт показывает о проекте, который собирает завод.

import { isLine, isObject } from "./guards.ts";
import { isRecordingId } from "./recording.ts";

/**
 * Карточка проекта для сайта: название, описание и ссылки. Как проект собирать — в
 * `.cyberzavod/project.json` его репозитория, сюда это не попадает.
 */
export interface Project {
  /** Идентификатор проекта: тот же, что `Recording.project`, и часть адреса страницы проекта. */
  id: string;
  name: string;
  /** Описание одной строкой. */
  description: string;
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
function parseLink(raw: Record<string, unknown>, field: "repo" | "website"): Partial<Project> {
  const value = raw[field];
  if (value === undefined) return {};
  if (!isSecureUrl(value)) {
    throw new ProjectError(`${field} должен быть адресом с https`);
  }
  return { [field]: value };
}

/**
 * Проверяет карточку проекта, пришедшую извне, и возвращает её типизированной.
 * @param {unknown} raw Разобранный JSON карточки.
 * @returns {Project} Проверенная карточка; неизвестные поля отброшены.
 * @throws {ProjectError} Если карточка не соответствует формату.
 */
export function parseProject(raw: unknown): Project {
  if (!isObject(raw)) throw new ProjectError("карточка проекта должна быть объектом");
  const { id, name, description } = raw;
  if (!isRecordingId(id)) throw new ProjectError("id должен состоять из букв, цифр, «_» и «-»");
  if (!isLine(name)) {
    throw new ProjectError("name должно быть непустой строкой без переводов строки");
  }
  if (!isLine(description)) {
    throw new ProjectError("description должно быть непустой строкой без переводов строки");
  }

  return { id, name, description, ...parseLink(raw, "repo"), ...parseLink(raw, "website") };
}
