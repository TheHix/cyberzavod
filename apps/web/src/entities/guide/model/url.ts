import type { Locale } from "@/shared/i18n/locale.ts";
import { localizedPath } from "@/shared/i18n/path.ts";

/**
 * The guide page address on the site.
 * @param {string} id Guide id.
 * @param {Locale} locale Page language.
 * @returns {string} A path like `/guides/connect-project/`, for Russian with a `/ru` prefix.
 */
export function guideUrl(id: string, locale: Locale): string {
  return localizedPath(locale, `/guides/${id}/`);
}
