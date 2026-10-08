import { describe, expect, it, vi } from "vitest";
import { CommandError } from "../errors.ts";
import { waitForAccessToken } from "./device-flow.ts";
import { fakeGithub, SECRET_TOKEN } from "./fixtures.ts";
import type { DeviceCode, GithubDeviceAuth, TokenPoll } from "./github.ts";

const CODE: DeviceCode = {
  deviceCode: "device-code",
  userCode: "WDJB-MJHT",
  verificationUri: "https://github.com/login/device",
  expiresInSeconds: 900,
  intervalSeconds: 5,
};

function authAnswering(...polls: TokenPoll[]): GithubDeviceAuth {
  const queue = [...polls];

  return fakeGithub({
    pollAccessToken: vi.fn(async () => {
      const poll = queue.shift();

      if (poll === undefined) throw new Error("опросов больше, чем ответов");

      return poll;
    }),
  });
}

function wait(auth: GithubDeviceAuth, code: DeviceCode = CODE) {
  const sleep = vi.fn(async () => undefined);
  const result = waitForAccessToken({ auth, clientId: "client-id", code, sleep });

  return { result, sleep };
}

describe("waitForAccessToken", () => {
  it("возвращает токен, когда человек подтвердил код", async () => {
    const auth = authAnswering({ status: "granted", token: SECRET_TOKEN });

    const { result, sleep } = wait(auth);

    await expect(result).resolves.toBe(SECRET_TOKEN);
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it("при authorization_pending опрашивает снова с тем же интервалом", async () => {
    const auth = authAnswering(
      { status: "pending" },
      { status: "pending" },
      { status: "granted", token: SECRET_TOKEN },
    );

    const { result, sleep } = wait(auth);

    await expect(result).resolves.toBe(SECRET_TOKEN);
    expect(sleep.mock.calls).toEqual([[5000], [5000], [5000]]);
  });

  it("slow_down увеличивает интервал на пять секунд", async () => {
    const auth = authAnswering(
      { status: "pending" },
      { status: "slow_down" },
      { status: "granted", token: SECRET_TOKEN },
    );

    const { result, sleep } = wait(auth);

    await expect(result).resolves.toBe(SECRET_TOKEN);
    expect(sleep.mock.calls).toEqual([[5000], [5000], [10000]]);
  });

  it("expired_token — ошибка с просьбой войти заново", async () => {
    const auth = authAnswering({ status: "expired" });

    const { result } = wait(auth);

    await expect(result).rejects.toThrow(CommandError);
    await expect(result).rejects.toThrow(/expired/);
  });

  it("access_denied — ошибка об отказе", async () => {
    const auth = authAnswering({ status: "denied" });

    const { result } = wait(auth);

    await expect(result).rejects.toThrow(/denied/);
  });

  it("перестаёт ждать, когда истёк срок кода, даже если GitHub молчит", async () => {
    const auth = authAnswering({ status: "pending" }, { status: "pending" });
    const shortLived = { ...CODE, expiresInSeconds: 10 };

    const { result } = wait(auth, shortLived);

    await expect(result).rejects.toThrow(/expired/);
  });
});
