import { parseProject, type Project } from "@cyberzavod/core";
import { LOCALES, type Locale } from "@/shared/i18n/locale.ts";

// Карточки читаются при сборке сайта: битая карточка роняет сборку, а не страницу у зрителя.
const files = import.meta.glob<unknown>("@projects/*.json", { eager: true, import: "default" });

/** Карточка проекта на сайте: название и описание на каждом языке сайта. */
export type PublishedProject = Project<Locale>;

function parsePublished([file, raw]: [string, unknown]): PublishedProject {
  try {
    return parseProject(raw, LOCALES);
  } catch (err) {
    throw new Error(`карточка проекта ${file} не прошла проверку`, { cause: err });
  }
}

/** Карточки проектов, которые собирает завод. */
export const publishedProjects: readonly PublishedProject[] =
  Object.entries(files).map(parsePublished);
