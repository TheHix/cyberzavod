// Ожидание подтверждения входа: опрос GitHub с интервалом из его ответа.

import { CommandError } from "../errors.ts";
import type { DeviceCode, GithubDeviceAuth } from "./github.ts";

/** На сколько секунд GitHub просит увеличить интервал после `slow_down`. */
const SLOW_DOWN_STEP_SECONDS = 5;
const MILLISECONDS_IN_SECOND = 1000;

/** Что нужно ожиданию входа. */
export interface DeviceFlowOptions {
  auth: GithubDeviceAuth;
  clientId: string;
  code: DeviceCode;
  /** Пауза между опросами; в тестах — мгновенная. */
  sleep(milliseconds: number): Promise<void>;
}

/**
 * Опрашивает GitHub, пока человек не подтвердит код, и возвращает токен.
 * @param {DeviceFlowOptions} options Клиент GitHub, код устройства и пауза.
 * @returns {Promise<string>} Токен GitHub.
 * @throws {CommandError} Если код истёк или человек отказал.
 */
export async function waitForAccessToken(options: DeviceFlowOptions): Promise<string> {
  const { auth, clientId, code, sleep } = options;
  let intervalSeconds = code.intervalSeconds;
  let waitedSeconds = 0;

  while (waitedSeconds < code.expiresInSeconds) {
    await sleep(intervalSeconds * MILLISECONDS_IN_SECOND);
    waitedSeconds += intervalSeconds;

    const poll = await auth.pollAccessToken(clientId, code.deviceCode);

    switch (poll.status) {
      case "granted":
        return poll.token;
      case "pending":
        break;
      case "slow_down":
        intervalSeconds += SLOW_DOWN_STEP_SECONDS;
        break;
      case "expired":
        throw new CommandError("код входа истёк: запустите cyberzavod login заново");
      case "denied":
        throw new CommandError("вход отклонён на странице GitHub");
    }
  }

  throw new CommandError("код входа истёк: запустите cyberzavod login заново");
}
