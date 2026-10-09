// Waiting for login confirmation: polling GitHub at the interval from its response.

import { CommandError } from "../errors.ts";
import type { DeviceCode, GithubDeviceAuth } from "./github.ts";

/** How many seconds GitHub asks to add to the interval after `slow_down`. */
const SLOW_DOWN_STEP_SECONDS = 5;
const MILLISECONDS_IN_SECOND = 1000;

/** What waiting for login needs. */
export interface DeviceFlowOptions {
  auth: GithubDeviceAuth;
  clientId: string;
  code: DeviceCode;
  /** Pause between polls; instant in tests. */
  sleep(milliseconds: number): Promise<void>;
}

/**
 * Polls GitHub until the human confirms the code, and returns the token.
 * @param {DeviceFlowOptions} options GitHub client, device code and pause.
 * @returns {Promise<string>} GitHub token.
 * @throws {CommandError} If the code expired or the human declined.
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
        throw new CommandError((messages) => messages.errors.loginCodeExpired);
      case "denied":
        throw new CommandError((messages) => messages.errors.loginDenied);
    }
  }

  throw new CommandError((messages) => messages.errors.loginCodeExpired);
}
