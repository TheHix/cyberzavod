import { describe, expect, it } from "vitest";
import { messageAnchor } from "./anchor.ts";

describe("messageAnchor", () => {
  it("нумерует якоря с единицы", () => {
    const anchors = [0, 1, 11].map(messageAnchor);

    expect(anchors).toEqual(["message-1", "message-2", "message-12"]);
  });
});
