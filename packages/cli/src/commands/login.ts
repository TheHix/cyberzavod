// `cyberzavod login` и `cyberzavod logout`: вход через GitHub и выход.

import type { CommandError } from "../errors.ts";
import { waitForAccessToken } from "../sharing/device-flow.ts";
import type { Sharing } from "../sharing/services.ts";

/**
 * Входит через GitHub: показывает код, ждёт подтверждения, проверяет токен на сервере и
 * сохраняет его. Токен нигде не печатается.
 * @param {Sharing} sharing Зависимости команд публикации.
 * @returns {Promise<void>} Готово, когда токен сохранён.
 * @throws {CommandError} Если код истёк, вход отклонён или GitHub недоступен.
 */
export async function login(sharing: Sharing): Promise<void> {
  const clientId = await sharing.api.githubClientId();
  const code = await sharing.github.requestDeviceCode(clientId);

  console.log(`Откройте ${code.verificationUri} и введите код ${code.userCode}`);
  console.log("Жду подтверждения…");

  const token = await waitForAccessToken({
    auth: sharing.github,
    clientId,
    code,
    sleep: (milliseconds) => sharing.sleep(milliseconds),
  });
  const me = await sharing.api.me(token);

  await sharing.credentials.save(token);
  console.log(`вход выполнен: ${me.login}`);
}

/**
 * Выходит: удаляет сохранённый токен.
 * @param {Sharing} sharing Зависимости команд публикации.
 * @returns {Promise<void>} Готово, когда токена не осталось.
 */
export async function logout(sharing: Sharing): Promise<void> {
  const hadToken = await sharing.credentials.remove();

  console.log(hadToken ? "вы вышли: токен удалён" : "входа и не было");
}
