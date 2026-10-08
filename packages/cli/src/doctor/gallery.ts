// Проверка входа в галерею: токен читается с диска, сеть не нужна. Вход нужен только для
// публикации записей, поэтому его отсутствие — не ошибка.

import { CommandError } from "../errors.ts";
import { failed, notice, passed, type MachineCheck } from "./check.ts";

/** Токен галереи сохранён; нет файла — заметка, битый файл — ошибка. Токен не печатается. */
export const galleryCheck: MachineCheck = {
  run: async (machine, messages) => {
    const { gallery } = messages.doctor;

    try {
      const token = await machine.credentials.read();

      if (token === undefined) {
        return notice({ summary: gallery.notSignedIn, hint: gallery.signIn });
      }

      return passed(gallery.signedIn);
    } catch (err) {
      if (err instanceof CommandError) {
        return failed({ problem: gallery.corrupt, fix: gallery.signInAgain });
      }

      throw err;
    }
  },
};
