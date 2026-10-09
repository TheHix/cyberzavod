// Who is signed in to the site: the menu on every page and the account page need it. There is one
// `GET /api/me` response per page, islands read a shared store; after sign-out or a gallery edit
// it is asked again.

import { atom, type ReadableAtom } from "nanostores";
import { fetchOwnGallery, type OwnGallery } from "@/entities/gallery";
import { settle, type Remote } from "@/shared/api/remote.ts";

/**
 * Who is viewing the page: not yet known, a guest (nobody signed in), an author with their gallery,
 * or it could not be found out: the response is broken or the request failed.
 */
export type Account =
  | { readonly status: "loading" }
  | { readonly status: "guest" }
  | { readonly status: "author"; readonly gallery: OwnGallery }
  | { readonly status: "broken" }
  | { readonly status: "failed" };

/** The "could not find out" and "still loading" states: shared `Remote` messages cover them. */
export type UnknownAccount = Extract<Account, { status: "loading" | "broken" | "failed" }>;

/** Sign-in model: who is viewing the page and the actions that find it out. */
export interface AccountModel {
  readonly $account: ReadableAtom<Account>;
  /**
   * Finds out who is signed in. A repeated call sends no second request: page islands share the
   * response.
   * @returns {Promise<void>} When the response is received or it is clear why it is missing.
   */
  load(): Promise<void>;
  /**
   * Asks again, after sign-out or a gallery edit. Until the response arrives the previous state
   * stays: the menu and the account page do not flash a loading state.
   * @returns {Promise<void>} When the response is received or it is clear why it is missing.
   */
  reload(): Promise<void>;
}

const LOADING: Account = { status: "loading" };
const GUEST: Account = { status: "guest" };
const FAILED: Account = { status: "failed" };

function accountOf(state: Remote<OwnGallery | undefined>): Account {
  switch (state.status) {
    case "ready":
      return state.value === undefined ? GUEST : { status: "author", gallery: state.value };
    // The API always answers /api/me: a 404 means something else answered.
    case "missing":
      return FAILED;
    default:
      return state;
  }
}

/**
 * Creates the sign-in model.
 * @param {() => Promise<OwnGallery | undefined>} fetchAccount Request for one's own gallery;
 * `undefined` means nobody is signed in.
 * @returns {AccountModel} A model with the initial "loading" state.
 */
export function createAccountModel(
  fetchAccount: () => Promise<OwnGallery | undefined>,
): AccountModel {
  const $account = atom<Account>(LOADING);
  let loading: Promise<void> | undefined;

  const reload = async () => {
    const state = await settle(fetchAccount);

    $account.set(accountOf(state));
  };

  return {
    $account,
    load: () => {
      loading ??= reload();

      return loading;
    },
    reload,
  };
}

const account = createAccountModel(() => fetchOwnGallery());

/** Who is viewing the page: shared by the menu and the account page. */
export const $account = account.$account;

/**
 * Finds out who is signed in; a second island on the page sends no second request.
 * @returns {Promise<void>} When the response is received or it is clear why it is missing.
 */
export function loadAccount(): Promise<void> {
  return account.load();
}

/**
 * Asks again who is signed in: after sign-out or a gallery edit.
 * @returns {Promise<void>} When the response is received or it is clear why it is missing.
 */
export function reloadAccount(): Promise<void> {
  return account.reload();
}
