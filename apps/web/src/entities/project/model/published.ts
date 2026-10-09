import { parseProject, type Project } from "@cyberzavod/core";
import { LOCALES, type Locale } from "@/shared/i18n/locale.ts";

// Cards are read at site build time: a broken card fails the build, not a viewer's page.
const files = import.meta.glob<unknown>("@projects/*.json", { eager: true, import: "default" });

/** A project card on the site: name and description in every site language. */
export type PublishedProject = Project<Locale>;

function parsePublished([file, raw]: [string, unknown]): PublishedProject {
  try {
    return parseProject(raw, LOCALES);
  } catch (err) {
    throw new Error(`карточка проекта ${file} не прошла проверку`, { cause: err });
  }
}

/** Cards of the projects the factory builds. */
export const publishedProjects: readonly PublishedProject[] =
  Object.entries(files).map(parsePublished);
