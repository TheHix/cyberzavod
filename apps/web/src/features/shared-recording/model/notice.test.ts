import { describe, expect, it } from "vitest";
import type { SharedRecording } from "@/entities/gallery";
import type { Remote } from "@/shared/api/remote.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { noticeOf } from "./notice.ts";

describe("noticeOf", () => {
  it.each([
    [{ status: "loading" }, UI_TEXT.sharedRecording.loading.ru],
    [{ status: "missing" }, UI_TEXT.sharedRecording.missing.ru],
    [{ status: "broken" }, UI_TEXT.sharedRecording.broken.ru],
    [{ status: "failed" }, UI_TEXT.sharedRecording.failed.ru],
  ] as const)("объясняет состояние %j", (state, expected) => {
    const notice = noticeOf(state, "ru");

    expect(notice).toBe(expected);
  });

  it("молчит, когда запись готова", () => {
    const state = {
      status: "ready",
      value: {} as SharedRecording,
    } satisfies Remote<SharedRecording>;

    const notice = noticeOf(state, "en");

    expect(notice).toBeUndefined();
  });
});
