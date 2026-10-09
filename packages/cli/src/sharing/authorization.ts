// The login author commands require: the token from the store and a clear error if it is not valid.

import { CommandError } from "../errors.ts";
import { isApiError, UNAUTHORIZED_CODE } from "./api.ts";
import type { Sharing } from "./services.ts";

/**
 * Runs an author action with the saved token.
 * @param {Sharing} sharing Dependencies of the sharing commands.
 * @param {(token: string) => Promise<Result>} action The action that needs the token.
 * @returns {Promise<Result>} The action result.
 * @throws {CommandError} If there was no login or the server did not accept the token.
 */
export async function withToken<Result>(
  sharing: Sharing,
  action: (token: string) => Promise<Result>,
): Promise<Result> {
  const token = await sharing.credentials.read();

  if (token === undefined) throw new CommandError((messages) => messages.errors.notLoggedIn);

  try {
    return await action(token);
  } catch (err) {
    if (!isApiError(err, UNAUTHORIZED_CODE)) throw err;

    throw new CommandError((messages) => messages.errors.tokenRejected, { cause: err });
  }
}
