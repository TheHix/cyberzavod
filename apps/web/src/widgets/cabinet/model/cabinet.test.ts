import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/shared/api/errors.ts";
import { createCabinetModel, type CabinetRequests } from "./cabinet.ts";

function succeedingRequests(): CabinetRequests {
  return {
    setGalleryPublic: vi.fn(() => Promise.resolve()),
    deleteRecording: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    reloadAccount: vi.fn(() => Promise.resolve()),
  };
}

describe("createCabinetModel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("открывает галерею и заново узнаёт, кто вошёл", async () => {
    const requests = succeedingRequests();
    const model = createCabinetModel(requests);

    await model.setGalleryPublic(true);

    expect({
      visibility: vi.mocked(requests.setGalleryPublic).mock.calls,
      reloads: vi.mocked(requests.reloadAccount).mock.calls.length,
      hasFailed: model.$hasFailed.get(),
    }).toEqual({ visibility: [[true]], reloads: 1, hasFailed: false });
  });

  it("удаляет запись по id", async () => {
    const requests = succeedingRequests();
    const model = createCabinetModel(requests);

    await model.deleteRecording("2026-10-05-4365c610");

    expect(requests.deleteRecording).toHaveBeenCalledWith("2026-10-05-4365c610");
  });

  it("занят, пока действие идёт, и свободен после", async () => {
    const requests = succeedingRequests();
    const model = createCabinetModel(requests);
    const seen: boolean[] = [];

    model.$isBusy.listen((isBusy) => seen.push(isBusy));

    await model.signOut();

    expect(seen).toEqual([true, false]);
  });

  it("сообщает о неудаче и всё равно заново узнаёт, кто вошёл", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const requests: CabinetRequests = {
      ...succeedingRequests(),
      deleteRecording: () => Promise.reject(new ApiRequestError(401, "unauthorized", "нет")),
    };
    const model = createCabinetModel(requests);

    await model.deleteRecording("a-1");

    expect({
      hasFailed: model.$hasFailed.get(),
      reloads: vi.mocked(requests.reloadAccount).mock.calls.length,
    }).toEqual({ hasFailed: true, reloads: 1 });
  });

  it("забывает прошлую неудачу при следующем действии", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failing = vi.fn<() => Promise<void>>(() => Promise.reject(new TypeError("Failed")));
    const requests: CabinetRequests = { ...succeedingRequests(), setGalleryPublic: failing };
    const model = createCabinetModel(requests);

    await model.setGalleryPublic(true);
    failing.mockImplementation(() => Promise.resolve());

    await model.setGalleryPublic(true);

    expect(model.$hasFailed.get()).toBe(false);
  });
});
