import { describe, expect, it, vi } from "vitest";
import { CLI_MESSAGES } from "../messages/catalog.ts";
import { ApiError } from "../sharing/api.ts";
import {
  fakeApi,
  fakeGithub,
  fakeSharing,
  author,
  memoryCredentials,
  SECRET_TOKEN,
  captureOutput,
} from "../sharing/fixtures.ts";
import { login, logout } from "./login.ts";

describe("login", () => {
  const printed = captureOutput();
  const messages = CLI_MESSAGES.ru;

  it("показывает код, сохраняет токен и называет логин", async () => {
    const credentials = memoryCredentials();
    const sharing = fakeSharing({
      credentials,
      api: fakeApi({ me: vi.fn(async () => author({ login: "alice" })) }),
    });

    await login(sharing, messages);

    expect({ token: await credentials.read(), output: printed() }).toMatchObject({
      token: SECRET_TOKEN,
      output: expect.stringContaining("WDJB-MJHT") as string,
    });
    expect(printed()).toContain("https://github.com/login/device");
    expect(printed()).toContain("вход выполнен: alice");
  });

  it("печатает адрес и код до первого опроса GitHub", async () => {
    let printedBeforePolling = "";
    const pollAccessToken = vi.fn(async () => {
      printedBeforePolling = printed();

      return { status: "granted" as const, token: SECRET_TOKEN };
    });
    const sharing = fakeSharing({
      credentials: memoryCredentials(),
      github: fakeGithub({ pollAccessToken }),
    });

    await login(sharing, messages);

    expect(printedBeforePolling).toContain("WDJB-MJHT");
    expect(printedBeforePolling).toContain("https://github.com/login/device");
  });

  it("не печатает токен", async () => {
    await login(fakeSharing({ credentials: memoryCredentials() }), messages);

    expect(printed()).not.toContain(SECRET_TOKEN);
  });

  it("ждёт подтверждения: pending, затем успех", async () => {
    const pollAccessToken = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "granted", token: SECRET_TOKEN });
    const credentials = memoryCredentials();
    const sharing = fakeSharing({ credentials, github: fakeGithub({ pollAccessToken }) });

    await login(sharing, messages);

    expect(await credentials.read()).toBe(SECRET_TOKEN);
  });

  it("отказ на странице GitHub — токен не сохраняется", async () => {
    const credentials = memoryCredentials();
    const sharing = fakeSharing({
      credentials,
      github: fakeGithub({ pollAccessToken: vi.fn(async () => ({ status: "denied" as const })) }),
    });

    const act = () => login(sharing, messages);

    await expect(act()).rejects.toThrow(/denied/);
    expect(await credentials.read()).toBeUndefined();
  });

  it("если сервер не принял токен, он не сохраняется", async () => {
    const credentials = memoryCredentials();
    const rejecting = new ApiError("Не авторизован", "unauthorized", 401);
    const sharing = fakeSharing({
      credentials,
      api: fakeApi({ me: vi.fn(async () => Promise.reject(rejecting)) }),
    });

    const act = () => login(sharing, messages);

    await expect(act()).rejects.toThrow(rejecting);
    expect(await credentials.read()).toBeUndefined();
  });

  it("вход недоступен на сервере — ошибка сервера", async () => {
    const unavailable = new ApiError("Вход недоступен", "auth_unavailable", 503);
    const sharing = fakeSharing({
      api: fakeApi({ githubClientId: vi.fn(async () => Promise.reject(unavailable)) }),
    });

    const act = () => login(sharing, messages);

    await expect(act()).rejects.toThrow("Вход недоступен");
  });
});

describe("logout", () => {
  const printed = captureOutput();
  const messages = CLI_MESSAGES.ru;

  it("удаляет сохранённый токен", async () => {
    const credentials = memoryCredentials(SECRET_TOKEN);

    await logout(fakeSharing({ credentials }), messages);

    expect({ token: await credentials.read(), output: printed() }).toEqual({
      token: undefined,
      output: "вы вышли: токен удалён",
    });
  });

  it("без входа сообщает, что выходить не из чего", async () => {
    await logout(fakeSharing({ credentials: memoryCredentials() }), messages);

    expect(printed()).toBe("входа и не было");
  });
});
