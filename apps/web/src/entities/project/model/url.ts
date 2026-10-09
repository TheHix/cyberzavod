import type { Locale } from "@/shared/i18n/locale.ts";
import { localizedPath } from "@/shared/i18n/path.ts";

/**
 * The project page address on the site.
 * @param {string} id Project id.
 * @param {Locale} locale Page language.
 * @returns {string} A path like `/projects/split-bill/`, for Russian with a `/ru` prefix.
 */
export function projectUrl(id: string, locale: Locale): string {
  return localizedPath(locale, `/projects/${id}/`);
}
