// Author actions in the cabinet: each changes data in the API, and the cabinet and menu learn the
// result with a new `GET /api/me` request, so the page has no second description of the gallery.

import { atom, type ReadableAtom } from "nanostores";

/** Cabinet requests to the API and the request that finds out again who is signed in. */
export interface CabinetRequests {
  setGalleryPublic(isPublic: boolean): Promise<void>;
  deleteRecording(id: string): Promise<void>;
  signOut(): Promise<void>;
  reloadAccount(): Promise<void>;
}

/** Cabinet model: whether an action is running, whether the last one failed, and the actions. */
export interface CabinetModel {
  /** An action is running: buttons are disabled so a second one is not sent over the first. */
  readonly $isBusy: ReadableAtom<boolean>;
  /** The last action failed: the cabinet shows a message. */
  readonly $hasFailed: ReadableAtom<boolean>;
  /**
   * Makes the gallery public or private.
   * @param {boolean} isPublic Whether to make the gallery public.
   * @returns {Promise<void>} When the change is saved and the cabinet updated, or it is clear it is
   *   not.
   */
  setGalleryPublic(isPublic: boolean): Promise<void>;
  /**
   * Deletes a recording from the gallery.
   * @param {string} id Recording id.
   * @returns {Promise<void>} When the recording is deleted and the cabinet updated, or it is clear
   *   it is not.
   */
  deleteRecording(id: string): Promise<void>;
  /**
   * Signs out of the site.
   * @returns {Promise<void>} When sign-out is done and the cabinet updated, or it is clear it is
   *   not.
   */
  signOut(): Promise<void>;
}

/**
 * Creates the cabinet model. After any action, successful or not, the cabinet finds out again who
 * is signed in: for example, the session may have expired, and then the author becomes a guest.
 * @param {CabinetRequests} requests API requests.
 * @returns {CabinetModel} A model with no running actions.
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
