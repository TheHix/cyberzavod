import { describe, expect, it, vi } from "vitest";
import {
  author,
  fakeApi,
  fakeSharing,
  memoryCredentials,
  SECRET_TOKEN,
  summary,
  TEST_SITE_URL,
  captureOutput,
} from "../sharing/fixtures.ts";
import { CLI_MESSAGES } from "../messages/catalog.ts";
import { galleryAccessOf, showGallery } from "./gallery.ts";

describe("galleryAccessOf", () => {
  it.each([
    [true, false, "public"],
    [false, true, "private"],
    [false, false, "keep"],
  ] as const)("--public=%s --private=%s даёт %s", (isPublic, isPrivate, expected) => {
    const access = galleryAccessOf(isPublic, isPrivate);

    expect(access).toBe(expected);
  });

  it("оба флага сразу — ошибка", () => {
    const act = () => galleryAccessOf(true, true);

    expect(act).toThrow(/cannot be combined/);
  });
});

describe("showGallery", () => {
  const printed = captureOutput();
  const messages = CLI_MESSAGES.ru;

  it("закрытая галерея: записи со ссылками, лимит и подсказка открыть", async () => {
    const api = fakeApi({
      me: vi.fn(async () =>
        author({ recordings: [summary({ id: "a-1", title: "Первая", slug: "slug1" })] }),
      ),
    });

    await showGallery(fakeSharing({ api }), "keep", messages);

    expect(printed()).toContain("закрыта");
    expect(printed()).toContain("Записи: 1 из 5");
    expect(printed()).toContain("a-1  Первая");
    expect(printed()).toContain(`${TEST_SITE_URL}/r/?id=slug1`);
    expect(printed()).toContain("cyberzavod gallery --public");
    expect(api.setGalleryPublic).not.toHaveBeenCalled();
  });

  it("--public открывает галерею и показывает ссылку и бейдж", async () => {
    const api = fakeApi({ me: vi.fn(async () => author({ galleryPublic: true })) });

    await showGallery(fakeSharing({ api }), "public", messages);

    expect(api.setGalleryPublic).toHaveBeenCalledWith(SECRET_TOKEN, true);
    expect(printed()).toContain("открыта");
    expect(printed()).toContain(`${TEST_SITE_URL}/gallery/?user=alice`);
    expect(printed()).toContain(
      `[![Built at Cyberzavod](${TEST_SITE_URL}/api/badges/alice.svg)](${TEST_SITE_URL}/gallery/?user=alice)`,
    );
  });

  it("--private закрывает галерею и не показывает бейдж", async () => {
    const api = fakeApi();

    await showGallery(fakeSharing({ api }), "private", messages);

    expect(api.setGalleryPublic).toHaveBeenCalledWith(SECRET_TOKEN, false);
    expect(printed()).not.toContain("/api/badges/");
  });

  it("не печатает токен", async () => {
    await showGallery(fakeSharing(), "keep", messages);

    expect(printed()).not.toContain(SECRET_TOKEN);
  });

  it("без входа просит войти", async () => {
    const sharing = fakeSharing({ credentials: memoryCredentials() });

    const act = () => showGallery(sharing, "keep", messages);

    await expect(act()).rejects.toThrow(/not signed in/);
  });
});
