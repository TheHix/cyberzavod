import { describe, expect, it } from "vitest";
import type { SessionRecord } from "@cyberzavod/core";
import type { Remote } from "@/shared/api/remote.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { seriesJournalNoticeOf } from "./series-notice.ts";

function session(): SessionRecord {
  return {
    version: 1,
    type: "session",
    id: "2026-10-07-4948cd46",
    timestamp: "2026-10-07T08:00:00.000Z",
    projectId: "doc-diff",
    source: { type: "manual" },
    data: {
      title: "Каркас",
      language: "en",
      workflow: "default",
      harness: "0.0.0",
      events: [
        { t: 0, type: "build_start" },
        { t: 1, type: "build_end", ok: true },
      ],
    },
  };
}

describe("seriesJournalNoticeOf", () => {
  it.each([
    [{ status: "loading" }, UI_TEXT.series.journalLoading.ru],
    [{ status: "missing" }, UI_TEXT.series.journalMissing.ru],
    [{ status: "broken" }, UI_TEXT.series.journalBroken.ru],
    [{ status: "failed" }, UI_TEXT.series.journalFailed.ru],
  ] as const)("объясняет состояние %o", (state, expected) => {
    const notice = seriesJournalNoticeOf(state, "ru");

    expect(notice).toBe(expected);
  });

  it("молчит, когда запись готова", () => {
    const state: Remote<SessionRecord> = { status: "ready", value: session() };

    const notice = seriesJournalNoticeOf(state, "en");

    expect(notice).toBeUndefined();
  });
});
