// `cyberzavod login` and `cyberzavod logout`: logging in through GitHub and logging out.

import type { CommandError } from "../errors.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { waitForAccessToken } from "../sharing/device-flow.ts";
import type { Sharing } from "../sharing/services.ts";

/**
 * Logs in through GitHub: shows the code, waits for confirmation, checks the token on the server
 * and saves it. The token is never printed.
 * @param {Sharing} sharing Dependencies of the sharing commands.
 * @param {CliMessages} messages Messages in the chosen language.
 * @returns {Promise<void>} Done when the token is saved.
 * @throws {CommandError} If the code expired, the login was rejected or GitHub is unavailable.
 */
export async function login(sharing: Sharing, messages: CliMessages): Promise<void> {
  const clientId = await sharing.api.githubClientId();
  const code = await sharing.github.requestDeviceCode(clientId);

  console.log(messages.login.openVerification({ url: code.verificationUri, code: code.userCode }));
  console.log(messages.login.waiting);

  const token = await waitForAccessToken({
    auth: sharing.github,
    clientId,
    code,
    sleep: (milliseconds) => sharing.sleep(milliseconds),
  });
  const me = await sharing.api.me(token);

  await sharing.credentials.save(token);
  console.log(messages.login.loggedIn(me.login));
}

/**
 * Logs out: removes the saved token.
 * @param {Sharing} sharing Dependencies of the sharing commands.
 * @param {CliMessages} messages Messages in the chosen language.
 * @returns {Promise<void>} Done when no token is left.
 */
export async function logout(sharing: Sharing, messages: CliMessages): Promise<void> {
  const hadToken = await sharing.credentials.remove();

  console.log(hadToken ? messages.login.loggedOut : messages.login.wasNotLoggedIn);
}
