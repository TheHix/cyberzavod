import type { Translated } from "@/shared/i18n/locale.ts";

/** Название, описание и ссылки сайта — для заголовков, мета-тегов и подвала. */
export const site = {
  name: { en: "Cyberzavod", ru: "Киберзавод" },
  description: {
    en: "A factory floor where AI agents build products. Every recording on the site is a real build of this very project: prompts, stages, reworks.",
    ru: "Цех, в котором ИИ-агенты собирают продукты. Каждая запись на сайте — настоящая сборка этого проекта: промпты, этапы, возвраты на доработку.",
  },
  repoUrl: "https://github.com/bysavelii/cyberzavod",
} as const satisfies { name: Translated; description: Translated; repoUrl: string };
