import type { MarkdownInstance } from "astro";
import { guideFileOf, parseGuideMeta } from "./guide.ts";
import { byGuideOrder } from "./order.ts";
import { pairTranslations, type Guide, type GuideFile } from "./translations.ts";

type MarkdownFile = MarkdownInstance<Record<string, unknown>>;

/** Guide body: `<Content />` renders it on the page. */
type GuideContent = MarkdownFile["Content"];

/** A published guide: id, place in the list and checked translations into all site languages. */
export type PublishedGuide = Guide<GuideContent>;

// Guides are read at site build time: a broken or untranslated guide fails the build, not a
// reader's page.
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

const guideFiles = Object.entries(files).map(parseFile);

/** Site guides in `order` order. */
export const publishedGuides: readonly PublishedGuide[] =
  pairTranslations(guideFiles).sort(byGuideOrder);
