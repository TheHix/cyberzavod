import type { MarkdownInstance } from "astro";
import { guideIdOf, parseGuideMeta, type GuideMeta } from "./guide.ts";
import { byGuideOrder } from "./order.ts";

type GuideFile = MarkdownInstance<Record<string, unknown>>;

/** Опубликованный гайд: проверенные данные и тело, которое рисует `<Content />`. */
export interface PublishedGuide {
  meta: GuideMeta;
  Content: GuideFile["Content"];
}

// Гайды читаются при сборке сайта: битый гайд роняет сборку, а не страницу у читателя.
const files = import.meta.glob<GuideFile>("@guides/*.md", {
  eager: true,
});

function parsePublished([file, guide]: [string, GuideFile]): PublishedGuide {
  try {
    return {
      meta: parseGuideMeta(guideIdOf(file), guide.frontmatter),
      Content: guide.Content,
    };
  } catch (err) {
    throw new Error(`гайд ${file} не прошёл проверку`, { cause: err });
  }
}

/** Гайды сайта в порядке `order`. */
export const publishedGuides: readonly PublishedGuide[] = Object.entries(files)
  .map(parsePublished)
  .sort((a, b) => byGuideOrder(a.meta, b.meta));
