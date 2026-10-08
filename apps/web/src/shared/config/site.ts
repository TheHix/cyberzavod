import type { Translated } from "@/shared/i18n/locale.ts";

/** Название, описание, автор, ссылки и картинки сайта — для заголовков, мета-тегов и панели «О заводе». */
export const site = {
  name: { en: "Cyberzavod", ru: "Киберзавод" },
  description: {
    en: "A factory floor where AI agents build products. The site replays real builds of projects the floor made from scratch: prompts, stages, reworks.",
    ru: "Цех, в котором ИИ-агенты собирают продукты. На сайте — настоящие сборки проектов, которые цех собрал с нуля: промпты, этапы, возвраты на доработку.",
  },
  repoUrl: "https://github.com/bysavelii/cyberzavod",
  author: { name: "bysavelii", url: "https://bysavelii.com" },
  // Картинки собирают маршруты `src/pages/[...lang]/<имя>.ts`; у каждого языка — свои, с его надписью.
  images: {
    favicon: "/favicon.svg",
    touchIcon: "/apple-touch-icon.png",
    preview: "/preview.png",
  },
} as const satisfies {
  name: Translated;
  description: Translated;
  repoUrl: string;
  author: { name: string; url: string };
  images: { favicon: string; touchIcon: string; preview: string };
};
