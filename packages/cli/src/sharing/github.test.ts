import { describe, expect, it, vi } from "vitest";
import { CommandError } from "../errors.ts";
import { GITHUB_ACCESS_TOKEN_URL, GITHUB_DEVICE_CODE_URL, HttpGithubAuth } from "./github.ts";
import type { FetchFunction } from "./http.ts";

function answering(body: unknown): ReturnType<typeof vi.fn<FetchFunction>> {
  return vi.fn<FetchFunction>(async () => Response.json(body));
}

function sentForm(fetchStub: ReturnType<typeof vi.fn<FetchFunction>>): URLSearchParams {
  const [, init] = fetchStub.mock.calls[0] ?? [];

  return new URLSearchParams(String(init?.body));
}

describe("HttpGithubAuth.requestDeviceCode", () => {
  it("просит код у GitHub без scope и разбирает ответ", async () => {
    const fetchStub = answering({
      device_code: "dc",
      user_code: "WDJB-MJHT",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
    const auth = new HttpGithubAuth(fetchStub);

    const code = await auth.requestDeviceCode("client-id");

    expect({ url: fetchStub.mock.calls[0]?.[0], form: [...sentForm(fetchStub)], code }).toEqual({
      url: GITHUB_DEVICE_CODE_URL,
      form: [["client_id", "client-id"]],
      code: {
        deviceCode: "dc",
        userCode: "WDJB-MJHT",
        verificationUri: "https://github.com/login/device",
        expiresInSeconds: 900,
        intervalSeconds: 5,
      },
    });
  });

  it("неполный ответ — ошибка команды", async () => {
    const auth = new HttpGithubAuth(answering({ user_code: "X" }));

    const act = () => auth.requestDeviceCode("client-id");

    await expect(act()).rejects.toThrow(CommandError);
  });

  it("сбой сети — ошибка команды с адресом", async () => {
    const failing = vi.fn<FetchFunction>(async () => {
      throw new TypeError("fetch failed");
    });
    const auth = new HttpGithubAuth(failing);

    const act = () => auth.requestDeviceCode("client-id");

    await expect(act()).rejects.toThrow(/cannot reach https:\/\/github.com/);
  });
});

describe("HttpGithubAuth.pollAccessToken", () => {
  it("отправляет device_code и grant_type устройства", async () => {
    const fetchStub = answering({ access_token: "tok", token_type: "bearer" });
    const auth = new HttpGithubAuth(fetchStub);

    const poll = await auth.pollAccessToken("client-id", "dc");

    expect({
      url: fetchStub.mock.calls[0]?.[0],
      form: Object.fromEntries(sentForm(fetchStub)),
      poll,
    }).toEqual({
      url: GITHUB_ACCESS_TOKEN_URL,
      form: {
        client_id: "client-id",
        device_code: "dc",
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      },
      poll: { status: "granted", token: "tok" },
    });
  });

  it.each([
    ["authorization_pending", { status: "pending" }],
    ["slow_down", { status: "slow_down" }],
    ["expired_token", { status: "expired" }],
    ["access_denied", { status: "denied" }],
  ])("ошибка GitHub %s становится состоянием опроса", async (error, expected) => {
    const auth = new HttpGithubAuth(answering({ error }));

    const poll = await auth.pollAccessToken("client-id", "dc");

    expect(poll).toEqual(expected);
  });

  it("неизвестная ошибка GitHub — ошибка команды с его описанием", async () => {
    const auth = new HttpGithubAuth(
      answering({ error: "device_flow_disabled", error_description: "Device flow выключен" }),
    );

    const act = () => auth.pollAccessToken("client-id", "dc");

    await expect(act()).rejects.toThrow(/Device flow выключен/);
  });
});
