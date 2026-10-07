// Действия автора в кабинете: каждое меняет данные в API, а что получилось, кабинет и меню узнают
// новым запросом `GET /api/me` — второго описания галереи на странице нет.

import { atom, type ReadableAtom } from "nanostores";

/** Запросы кабинета к API и запрос, который заново узнаёт, кто вошёл. */
export interface CabinetRequests {
  setGalleryPublic(isPublic: boolean): Promise<void>;
  deleteRecording(id: string): Promise<void>;
  signOut(): Promise<void>;
  reloadAccount(): Promise<void>;
}

/** Модель кабинета: идёт ли действие, не сорвалось ли последнее, и сами действия. */
export interface CabinetModel {
  /** Идёт действие: кнопки выключены, чтобы не отправить второе поверх первого. */
  readonly $isBusy: ReadableAtom<boolean>;
  /** Последнее действие не удалось: кабинет показывает сообщение. */
  readonly $hasFailed: ReadableAtom<boolean>;
  /**
   * Открывает или закрывает галерею.
   * @param {boolean} isPublic Открыть ли галерею.
   * @returns {Promise<void>} Когда изменение сохранено и кабинет обновлён или стало ясно, что нет.
   */
  setGalleryPublic(isPublic: boolean): Promise<void>;
  /**
   * Удаляет запись из галереи.
   * @param {string} id id записи.
   * @returns {Promise<void>} Когда запись удалена и кабинет обновлён или стало ясно, что нет.
   */
  deleteRecording(id: string): Promise<void>;
  /**
   * Выходит с сайта.
   * @returns {Promise<void>} Когда выход сделан и кабинет обновлён или стало ясно, что нет.
   */
  signOut(): Promise<void>;
}

/**
 * Создаёт модель кабинета. После любого действия, удачного или нет, кабинет заново узнаёт, кто
 * вошёл: например, сессия могла истечь, и тогда автор становится гостем.
 * @param {CabinetRequests} requests Запросы к API.
 * @returns {CabinetModel} Модель без идущих действий.
 */
export function createCabinetModel(requests: CabinetRequests): CabinetModel {
  const $isBusy = atom(false);
  const $hasFailed = atom(false);

  const perform = async (change: () => Promise<void>) => {
    $isBusy.set(true);
    $hasFailed.set(false);

    try {
      await change();
    } catch (err) {
      console.error("изменение в кабинете не сохранено", err);
      $hasFailed.set(true);
    }

    await requests.reloadAccount();
    $isBusy.set(false);
  };

  return {
    $isBusy,
    $hasFailed,
    setGalleryPublic: (isPublic) => perform(() => requests.setGalleryPublic(isPublic)),
    deleteRecording: (id) => perform(() => requests.deleteRecording(id)),
    signOut: () => perform(() => requests.signOut()),
  };
}
