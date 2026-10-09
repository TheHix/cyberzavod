import type { Translated } from "@/shared/i18n/locale.ts";

/** Site name, description, author, links and images: for titles, meta tags and the About panel. */
export const site = {
  name: { en: "Cyberzavod", ru: "Киберзавод" },
  description: {
    en: "A factory floor where AI agents build products. The site replays real builds of projects the floor made from scratch: prompts, stages, reworks.",
    ru: "Цех, в котором ИИ-агенты собирают продукты. На сайте — настоящие сборки проектов, которые цех собрал с нуля: промпты, этапы, возвраты на доработку.",
  },
  repoUrl: "https://github.com/bysavelii/cyberzavod",
  author: { name: "bysavelii", url: "https://bysavelii.com" },
  // Images are built by the `src/pages/[...lang]/<name>.ts` routes; each language has its own,
  // with its own text.
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
