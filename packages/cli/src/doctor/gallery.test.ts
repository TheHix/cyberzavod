import { describe, expect, it } from "vitest";
import { CommandError } from "../errors.ts";
import { memoryCredentials, SECRET_TOKEN } from "../sharing/fixtures.ts";
import { galleryCheck } from "./gallery.ts";
import { machine, messages } from "./fixtures.ts";

describe("galleryCheck", () => {
  it("говорит о входе и не печатает токен", async () => {
    const result = await galleryCheck.run(machine(), messages);

    expect(result).toEqual({ status: "passed", summary: "gallery: signed in" });
    expect(JSON.stringify(result)).not.toContain(SECRET_TOKEN);
  });

  it("без входа даёт заметку с командой login, а не ошибку", async () => {
    const signedOut = machine({ credentials: memoryCredentials() });

    const result = await galleryCheck.run(signedOut, messages);

    expect(result).toEqual({
      status: "notice",
      summary: "gallery: not signed in (needed only to publish recordings)",
      hint: "to publish recordings, run npx cyberzavod login",
    });
  });

  it("при битом файле токена просит войти заново", async () => {
    const corrupted = machine({
      credentials: {
        ...memoryCredentials(),
        read: async () => {
          throw new CommandError((text) => text.errors.credentialsCorrupt("credentials.json"));
        },
      },
    });

    const result = await galleryCheck.run(corrupted, messages);

    expect(result).toEqual({
      status: "failed",
      problem: "gallery: the saved sign-in file is corrupted",
      fix: "run npx cyberzavod login again",
    });
  });

  it("не прячет неожиданную ошибку чтения", async () => {
    const broken = machine({
      credentials: {
        ...memoryCredentials(),
        read: async () => {
          throw new Error("disk failure");
        },
      },
    });

    const act = () => galleryCheck.run(broken, messages);

    await expect(act()).rejects.toThrow("disk failure");
  });
});
