// One galleries page serves both the shared list and an author's gallery: the `user` address
// parameter decides what to show, and the page learns it only in the browser.

import { atom, type ReadableAtom } from "nanostores";
import { queryParamOf, type Gallery, type GalleryListing } from "@/entities/gallery";
import { LOADING, settle, type Remote } from "@/shared/api/remote.ts";

/** What is on the galleries page: the shared list of public galleries or an author's gallery. */
export type GalleryPage =
  | { readonly view: "list"; readonly galleries: Remote<readonly GalleryListing[]> }
  | { readonly view: "author"; readonly login: string; readonly gallery: Remote<Gallery> };

/** Galleries page requests to the API. */
export interface GalleryRequests {
  fetchGalleries(): Promise<readonly GalleryListing[]>;
  fetchGallery(login: string): Promise<Gallery>;
}

/** Galleries page: what to show and the action that opens the page by its address. */
export interface GalleryPageModel {
  readonly $page: ReadableAtom<GalleryPage>;
  /**
   * Opens the author's gallery if the address has a login, otherwise the shared list.
   * @param {string} search Address parameters, `location.search`.
   * @returns {Promise<void>} When the data arrives or it is clear why there is none.
   */
  open(search: string): Promise<void>;
}

/**
 * Creates the galleries page model. The initial state is the shared list loading: this is also how
 * the page looks at build time, when there is no address with parameters yet.
 * @param {GalleryRequests} requests API requests.
 * @returns {GalleryPageModel} Page model.
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
