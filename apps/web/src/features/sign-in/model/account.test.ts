import { afterEach, describe, expect, it, vi } from "vitest";
import type { OwnGallery } from "@/entities/gallery";
import { ApiRequestError } from "@/shared/api/errors.ts";
import { createAccountModel } from "./account.ts";

function aliceGallery(): OwnGallery {
  return { login: "alice", galleryPublic: false, limit: 5, recordings: [] };
}

describe("createAccountModel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("начинает с загрузки", () => {
    const model = createAccountModel(() => Promise.resolve(aliceGallery()));

    const account = model.$account.get();

    expect(account).toEqual({ status: "loading" });
  });

  it("узнаёт вошедшего автора", async () => {
    const model = createAccountModel(() => Promise.resolve(aliceGallery()));

    await model.load();

    expect(model.$account.get()).toEqual({ status: "author", gallery: aliceGallery() });
  });

  it("называет гостем того, кто не вошёл", async () => {
    const model = createAccountModel(() => Promise.resolve(undefined));

    await model.load();

    expect(model.$account.get()).toEqual({ status: "guest" });
  });

  it("называет неудачей сбой сети", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const model = createAccountModel(() => Promise.reject(new TypeError("Failed to fetch")));

    await model.load();

    expect(model.$account.get()).toEqual({ status: "failed" });
  });

  it("называет неудачей ответ 404", async () => {
    const model = createAccountModel(() =>
      Promise.reject(new ApiRequestError(404, "not_found", "нет")),
    );

    await model.load();

    expect(model.$account.get()).toEqual({ status: "failed" });
  });

  it("шлёт один запрос, когда вход узнают меню и кабинет", async () => {
    const fetchAccount = vi.fn(() => Promise.resolve(aliceGallery()));
    const model = createAccountModel(fetchAccount);

    await Promise.all([model.load(), model.load()]);

    expect(fetchAccount).toHaveBeenCalledTimes(1);
  });

  it("спрашивает заново после выхода, не показывая загрузку", async () => {
    const answers = [aliceGallery(), undefined];
    const model = createAccountModel(() => Promise.resolve(answers.shift()));
    const seen: string[] = [];

    await model.load();
    model.$account.listen((account) => seen.push(account.status));

    await model.reload();

    expect(seen).toEqual(["guest"]);
  });
});
