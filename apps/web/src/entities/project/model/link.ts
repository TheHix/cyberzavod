import type { Project } from "@cyberzavod/core";
import { projectUrl } from "./url.ts";

/** Ссылка на страницу проекта: всё, что нужно острову цеха, без описания и ссылок карточки. */
export interface ProjectLink {
  name: string;
  url: string;
}

/**
 * Собирает ссылку на страницу проекта: в остров цеха уходит она, а не вся карточка.
 * @param {Project} project Карточка проекта.
 * @returns {ProjectLink} Название проекта и адрес его страницы.
 */
export function projectLinkOf(project: Project): ProjectLink {
  return { name: project.name, url: projectUrl(project.id) };
}
