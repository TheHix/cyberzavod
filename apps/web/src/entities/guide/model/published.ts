import type { MarkdownInstance } from "astro";
import { guideFileOf, parseGuideMeta } from "./guide.ts";
import { byGuideOrder } from "./order.ts";
import { pairTranslations, type Guide, type GuideFile } from "./translations.ts";

type MarkdownFile = MarkdownInstance<Record<string, unknown>>;

/** Тело гайда: его рисует `<Content />` на странице. */
type GuideContent = MarkdownFile["Content"];

/** Опубликованный гайд: id, место в списке и проверенные переводы на все языки сайта. */
export type PublishedGuide = Guide<GuideContent>;

// Гайды читаются при сборке сайта: битый или непереведённый гайд роняет сборку, а не страницу
// у читателя.
const files = import.meta.glob<MarkdownFile>("@guides/*.md", {
  eager: true,
});

function parseFile([file, markdown]: [string, MarkdownFile]): GuideFile<GuideContent> {
  try {
    const { id, locale } = guideFileOf(file);
    return { meta: parseGuideMeta(id, markdown.frontmatter), locale, body: markdown.Content };
  } catch (err) {
    throw new Error(`гайд ${file} не прошёл проверку`, { cause: err });
  }
}

/** Гайды сайта в порядке `order`. */
export const publishedGuides: readonly PublishedGuide[] = pairTranslations(
  Object.entries(files).map(parseFile),
).sort(byGuideOrder);
