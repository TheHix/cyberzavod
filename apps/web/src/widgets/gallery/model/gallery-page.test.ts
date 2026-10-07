import { describe, expect, it } from "vitest";
import type { Gallery, GalleryListing } from "@/entities/gallery";
import { ApiRequestError } from "@/shared/api/errors.ts";
import { createGalleryPageModel, type GalleryRequests } from "./gallery-page.ts";

function listing(): GalleryListing {
  return { login: "alice", recordingCount: 2, updatedAt: "2026-10-06T10:00:00Z" };
}

function aliceGallery(): Gallery {
  return { login: "alice", recordings: [] };
}

function requestsOf(galleries: readonly string[]): GalleryRequests {
  return {
    fetchGalleries: () => Promise.resolve([listing()]),
    fetchGallery: (login) =>
      galleries.includes(login)
        ? Promise.resolve(aliceGallery())
        : Promise.reject(new ApiRequestError(404, "not_found", "нет")),
  };
}

describe("createGalleryPageModel", () => {
  it("начинает с общего списка в загрузке", () => {
    const model = createGalleryPageModel(requestsOf(["alice"]));

    const page = model.$page.get();

    expect(page).toEqual({ view: "list", galleries: { status: "loading" } });
  });

  it("показывает общий список, если в адресе нет автора", async () => {
    const model = createGalleryPageModel(requestsOf(["alice"]));

    await model.open("");

    expect(model.$page.get()).toEqual({
      view: "list",
      galleries: { status: "ready", value: [listing()] },
    });
  });

  it("показывает галерею автора из адреса", async () => {
    const model = createGalleryPageModel(requestsOf(["alice"]));

    await model.open("?user=alice");

    expect(model.$page.get()).toEqual({
      view: "author",
      login: "alice",
      gallery: { status: "ready", value: aliceGallery() },
    });
  });

  it("называет закрытую галерею отсутствующей", async () => {
    const model = createGalleryPageModel(requestsOf(["alice"]));

    await model.open("?user=bob");

    expect(model.$page.get()).toEqual({
      view: "author",
      login: "bob",
      gallery: { status: "missing" },
    });
  });
});
