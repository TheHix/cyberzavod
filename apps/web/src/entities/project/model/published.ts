import { parseProject, type Project } from "@cyberzavod/core";

// Карточки читаются при сборке сайта: битая карточка роняет сборку, а не страницу у зрителя.
const files = import.meta.glob<unknown>("@projects/*.json", { eager: true, import: "default" });

function parsePublished([file, raw]: [string, unknown]): Project {
  try {
    return parseProject(raw);
  } catch (err) {
    throw new Error(`карточка проекта ${file} не прошла проверку`, { cause: err });
  }
}

/** Карточки проектов, которые собирает завод. */
export const publishedProjects: readonly Project[] = Object.entries(files).map(parsePublished);
