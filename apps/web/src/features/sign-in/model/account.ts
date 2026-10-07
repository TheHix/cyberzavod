// Кто вошёл на сайт: это нужно меню на каждой странице и кабинету. Ответ `GET /api/me` один на
// страницу, острова читают общий стор; после выхода или правки галереи его спрашивают заново.

import { atom, type ReadableAtom } from "nanostores";
import { fetchOwnGallery, type OwnGallery } from "@/entities/gallery";
import { settle, type Remote } from "@/shared/api/remote.ts";

/**
 * Кто смотрит страницу: ещё неизвестно, гость (никто не вошёл), автор со своей галереей, или
 * узнать не удалось — ответ битый или запрос не прошёл.
 */
export type Account =
  | { readonly status: "loading" }
  | { readonly status: "guest" }
  | { readonly status: "author"; readonly gallery: OwnGallery }
  | { readonly status: "broken" }
  | { readonly status: "failed" };

/** Состояние «узнать не удалось» и «ещё грузится»: для них есть общие сообщения `Remote`. */
export type UnknownAccount = Extract<Account, { status: "loading" | "broken" | "failed" }>;

/** Модель входа: кто смотрит страницу и действия, которые это узнают. */
export interface AccountModel {
  readonly $account: ReadableAtom<Account>;
  /**
   * Узнаёт, кто вошёл. Повторный вызов не шлёт второй запрос: острова страницы делят ответ.
   * @returns {Promise<void>} Когда ответ получен или стало ясно, почему его нет.
   */
  load(): Promise<void>;
  /**
   * Спрашивает заново — после выхода или правки галереи. Пока ответа нет, остаётся прежнее
   * состояние: меню и кабинет не мигают загрузкой.
   * @returns {Promise<void>} Когда ответ получен или стало ясно, почему его нет.
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
    // На /api/me API отвечает всегда: 404 значит, что ответил не он.
    case "missing":
      return FAILED;
    default:
      return state;
  }
}

/**
 * Создаёт модель входа.
 * @param {() => Promise<OwnGallery | undefined>} fetchAccount Запрос своей галереи; `undefined` —
 * никто не вошёл.
 * @returns {AccountModel} Модель с начальным состоянием «грузится».
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

/** Кто смотрит страницу: общий для меню и кабинета. */
export const $account = account.$account;

/**
 * Узнаёт, кто вошёл; второй остров страницы не шлёт второй запрос.
 * @returns {Promise<void>} Когда ответ получен или стало ясно, почему его нет.
 */
export function loadAccount(): Promise<void> {
  return account.load();
}

/**
 * Спрашивает заново, кто вошёл: после выхода или правки галереи.
 * @returns {Promise<void>} Когда ответ получен или стало ясно, почему его нет.
 */
export function reloadAccount(): Promise<void> {
  return account.reload();
}
