import { describe, expect, it } from "vitest";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { remoteNoticeOf } from "./remote-notice.ts";

const MISSING = { en: "No gallery.", ru: "Галереи нет." };

describe("remoteNoticeOf", () => {
  it.each([
    ["loading", UI_TEXT.remote.loading.en],
    ["missing", MISSING.en],
    ["broken", UI_TEXT.remote.broken.en],
    ["failed", UI_TEXT.remote.failed.en],
  ] as const)("объясняет состояние %s", (status, expected) => {
    const notice = remoteNoticeOf({ status }, MISSING, "en");

    expect(notice).toBe(expected);
  });

  it("молчит, когда данные готовы", () => {
    const notice = remoteNoticeOf({ status: "ready", value: 1 }, MISSING, "ru");

    expect(notice).toBeUndefined();
  });
});
