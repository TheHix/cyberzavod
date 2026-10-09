import type { Locale } from "@/shared/i18n/locale.ts";
import type { PublishedProject } from "./published.ts";
import { projectUrl } from "./url.ts";

/** Link to a project page: what the factory floor island needs, without the card's description. */
export interface ProjectLink {
  name: string;
  url: string;
}

/**
 * Builds a link to a project page: the factory floor island gets this, not the whole card.
 * @param {PublishedProject} project Project card.
 * @param {Locale} locale Language of the page the link leads to.
 * @returns {ProjectLink} Project name in the page language and its page address.
 */
export function projectLinkOf(project: PublishedProject, locale: Locale): ProjectLink {
  return { name: project.name[locale], url: projectUrl(project.id, locale) };
}
