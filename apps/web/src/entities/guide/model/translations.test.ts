import { describe, expect, it } from "vitest";
import type { Locale } from "@/shared/i18n/locale.ts";
import { GuideError } from "./guide.ts";
import { pairTranslations, type GuideFile } from "./translations.ts";

function guideFile(id: string, locale: Locale, order = 1): GuideFile<string> {
  return {
    meta: { id, title: `${id} ${locale}`, description: `описание ${locale}`, order },
    locale,
    body: `тело ${locale}`,
  };
}

describe("pairTranslations", () => {
  it("собирает переводы с общим id в один гайд", () => {
    const files = [guideFile("how-to", "ru"), guideFile("how-to", "en")];

    const guides = pairTranslations(files);

    expect(guides).toEqual([
      {
        id: "how-to",
        order: 1,
        translations: {
          en: { title: "how-to en", description: "описание en", body: "тело en" },
          ru: { title: "how-to ru", description: "описание ru", body: "тело ru" },
        },
      },
    ]);
  });

  it("у гайдов всех языков одинаковые id и order", () => {
    const files = [
      guideFile("a", "en", 2),
      guideFile("b", "ru", 1),
      guideFile("a", "ru", 2),
      guideFile("b", "en", 1),
    ];

    const guides = pairTranslations(files);

    expect(guides.map(({ id, order }) => ({ id, order }))).toEqual([
      { id: "a", order: 2 },
      { id: "b", order: 1 },
    ]);
  });

  it.each([
    ["без английского перевода", [guideFile("a", "ru")], "en"],
    ["без русского перевода", [guideFile("a", "en")], "ru"],
    ["с непарным id", [guideFile("a", "en"), guideFile("a", "ru"), guideFile("b", "en")], "«b»"],
    ["с разным order", [guideFile("a", "en", 1), guideFile("a", "ru", 2)], "order"],
    [
      "с двумя файлами одного языка",
      [guideFile("a", "en"), guideFile("a", "en"), guideFile("a", "ru")],
      "два файла",
    ],
  ])("отклоняет гайд %s", (_case, files, message) => {
    const act = () => pairTranslations(files);

    expect(act).toThrow(GuideError);
    expect(act).toThrow(message);
  });
});
