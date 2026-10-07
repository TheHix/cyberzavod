// Вход, который требуют команды автора: токен из хранилища и понятная ошибка, если он не годится.

import { CommandError } from "../errors.ts";
import { isApiError, UNAUTHORIZED_CODE } from "./api.ts";
import type { Sharing } from "./services.ts";

const LOGIN_HINT = "войдите командой cyberzavod login";

/**
 * Выполняет действие автора с сохранённым токеном.
 * @param {Sharing} sharing Зависимости команд публикации.
 * @param {(token: string) => Promise<Result>} action Действие, которому нужен токен.
 * @returns {Promise<Result>} Результат действия.
 * @throws {CommandError} Если входа не было или сервер не принял токен.
 */
export async function withToken<Result>(
  sharing: Sharing,
  action: (token: string) => Promise<Result>,
): Promise<Result> {
  const token = await sharing.credentials.read();

  if (token === undefined) throw new CommandError(`нет входа: ${LOGIN_HINT}`);

  try {
    return await action(token);
  } catch (err) {
    if (!isApiError(err, UNAUTHORIZED_CODE)) throw err;

    throw new CommandError(`${err.message}: ${LOGIN_HINT}`, { cause: err });
  }
}
