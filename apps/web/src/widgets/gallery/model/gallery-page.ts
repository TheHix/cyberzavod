// Страница галерей одна на общий список и на галерею автора: что показывать, решает параметр
// адреса `user`, который страница узнаёт только в браузере.

import { atom, type ReadableAtom } from "nanostores";
import { queryParamOf, type Gallery, type GalleryListing } from "@/entities/gallery";
import { LOADING, settle, type Remote } from "@/shared/api/remote.ts";

/** Что на странице галерей: общий список открытых галерей или галерея автора. */
export type GalleryPage =
  | { readonly view: "list"; readonly galleries: Remote<readonly GalleryListing[]> }
  | { readonly view: "author"; readonly login: string; readonly gallery: Remote<Gallery> };

/** Запросы страницы галерей к API. */
export interface GalleryRequests {
  fetchGalleries(): Promise<readonly GalleryListing[]>;
  fetchGallery(login: string): Promise<Gallery>;
}

/** Страница галерей: что показывать и действие, которое открывает страницу по адресу. */
export interface GalleryPageModel {
  readonly $page: ReadableAtom<GalleryPage>;
  /**
   * Открывает галерею автора, если в адресе есть логин, иначе общий список.
   * @param {string} search Параметры адреса — `location.search`.
   * @returns {Promise<void>} Когда данные получены или стало ясно, почему их нет.
   */
  open(search: string): Promise<void>;
}

/**
 * Создаёт модель страницы галерей. Начальное состояние — общий список в загрузке: так страница
 * выглядит и при сборке, где адреса с параметрами ещё нет.
 * @param {GalleryRequests} requests Запросы к API.
 * @returns {GalleryPageModel} Модель страницы.
 */
export function createGalleryPageModel(requests: GalleryRequests): GalleryPageModel {
  const $page = atom<GalleryPage>({ view: "list", galleries: LOADING });

  const showList = async () => {
    $page.set({ view: "list", galleries: LOADING });

    const galleries = await settle(() => requests.fetchGalleries());

    $page.set({ view: "list", galleries });
  };

  const showAuthor = async (login: string) => {
    $page.set({ view: "author", login, gallery: LOADING });

    const gallery = await settle(() => requests.fetchGallery(login));

    $page.set({ view: "author", login, gallery });
  };

  return {
    $page,
    open: (search) => {
      const login = queryParamOf(search, "galleryOwner");

      return login === undefined ? showList() : showAuthor(login);
    },
  };
}
