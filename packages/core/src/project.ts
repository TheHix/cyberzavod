// Project card: what the site shows about a project the factory builds.

import { isLine, isObject } from "./guards.ts";
import { isRecordId } from "./record.ts";

/** Card text in each showcase language: the language is the key, the translation is the value. */
export type ProjectText<Language extends string> = Readonly<Record<Language, string>>;

/**
 * Project card for the site: name, description and links. Texts are in each showcase language,
 * links are shared. How to build the project lives in `.cyberzavod/project.json` of its
 * repository and does not get here.
 */
export interface Project<Language extends string> {
  /** Project id: the same as `SessionRecord.project`, and part of the project page address. */
  id: string;
  name: ProjectText<Language>;
  /** One-line description in each language. */
  description: ProjectText<Language>;
  /** Repository address, https. */
  repo?: string;
  /** Project website address, https. */
  website?: string;
  /**
   * Project languages and tools as they spell themselves: "TypeScript", "Vite". Not translated,
   * shown as is, in order.
   */
  stack?: readonly string[];
}

/** Project card error: the card came from outside and failed validation. */
export class ProjectError extends Error {}

const SECURE_PROTOCOL = "https:";

// The stack is a short caption for the project, not a list of dependencies.
const MAX_STACK_ITEMS = 6;

function isSecureUrl(value: unknown): value is string {
  if (typeof value !== "string" || !URL.canParse(value)) return false;

  return new URL(value).protocol === SECURE_PROTOCOL;
}

// Optional link: absent from the card means absent from the result, not `undefined`.
function parseLink(
  raw: Record<string, unknown>,
  field: "repo" | "website",
): Pick<Project<string>, "repo" | "website"> {
  const value = raw[field];

  if (value === undefined) return {};
  if (!isSecureUrl(value)) {
    throw new ProjectError(`${field} must be an https URL`);
  }

  return { [field]: value };
}

// Optional stack: absent from the card means absent from the result, as with links.
function parseStack(raw: Record<string, unknown>): Pick<Project<string>, "stack"> {
  const { stack } = raw;

  if (stack === undefined) return {};

  const isList = Array.isArray(stack) && stack.length > 0 && stack.length <= MAX_STACK_ITEMS;

  if (!isList || !stack.every(isLine)) {
    throw new ProjectError(
      `stack must be a list of 1–${MAX_STACK_ITEMS} non-empty single-line strings`,
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
    throw new ProjectError(`${field} must be an object with translations: ${languages.join(", ")}`);
  }

  const missing = languages.filter((language) => !isLine(raw[language]));

  if (missing.length > 0) {
    throw new ProjectError(
      `${field} in ${missing.join(", ")} must be a non-empty single-line string`,
    );
  }

  return Object.fromEntries(
    languages.map((language) => [language, raw[language]]),
  ) as ProjectText<Language>;
}

/**
 * Validates a project card that came from outside and returns it typed.
 * @param {unknown} raw Parsed JSON of the card.
 * @param {readonly Language[]} languages Showcase languages: name and description needed in each.
 * @returns {Project<Language>} The validated card; unknown fields and languages are dropped.
 * @throws {ProjectError} If the card does not match the format or lacks a translation.
 */
export function parseProject<Language extends string>(
  raw: unknown,
  languages: readonly Language[],
): Project<Language> {
  if (!isObject(raw)) throw new ProjectError("project card must be an object");

  const { id } = raw;

  if (!isRecordId(id)) {
    throw new ProjectError("id must contain only letters, digits, underscores and hyphens");
  }

  return {
    id,
    name: parseText(raw.name, "name", languages),
    description: parseText(raw.description, "description", languages),
    ...parseLink(raw, "repo"),
    ...parseLink(raw, "website"),
    ...parseStack(raw),
  };
}
