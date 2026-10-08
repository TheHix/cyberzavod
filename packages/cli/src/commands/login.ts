// `cyberzavod login` и `cyberzavod logout`: вход через GitHub и выход.

import type { CommandError } from "../errors.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { waitForAccessToken } from "../sharing/device-flow.ts";
import type { Sharing } from "../sharing/services.ts";

/**
 * Входит через GitHub: показывает код, ждёт подтверждения, проверяет токен на сервере и
 * сохраняет его. Токен нигде не печатается.
 * @param {Sharing} sharing Зависимости команд публикации.
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {Promise<void>} Готово, когда токен сохранён.
 * @throws {CommandError} Если код истёк, вход отклонён или GitHub недоступен.
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
 * Выходит: удаляет сохранённый токен.
 * @param {Sharing} sharing Зависимости команд публикации.
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {Promise<void>} Готово, когда токена не осталось.
 */
export async function logout(sharing: Sharing, messages: CliMessages): Promise<void> {
  const hadToken = await sharing.credentials.remove();

  console.log(hadToken ? messages.login.loggedOut : messages.login.wasNotLoggedIn);
}
