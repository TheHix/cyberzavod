import { API_PAGES } from "@/shared/config/routes.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { localizedPath } from "@/shared/i18n/path.ts";

/** Вход через GitHub начинается в API: обычная ссылка, а не запрос, — дальше редиректы OAuth. */
const SIGN_IN_PATH = "/api/auth/github/login";
/** Параметр, в котором API получает путь, куда вернуть браузер после входа. */
const RETURN_PARAM = "return";
/** Параметр и значение, с которыми API возвращает на сайт после неудачного входа: `/?login=failed`. */
const SIGN_IN_RESULT_PARAM = "login";
const SIGN_IN_FAILED = "failed";
/** Размер аватара GitHub в пикселях: с запасом на экран с плотными пикселями. */
const AVATAR_SIZE = 64;

/**
 * Адрес, с которого начинается вход через GitHub.
 * @param {string} returnPath Путь сайта с параметрами, куда вернуться после входа.
 * @returns {string} Путь вида `/api/auth/github/login?return=%2Fru%2Fme%2F`.
 */
export function signInUrl(returnPath: string): string {
  const query = new URLSearchParams({ [RETURN_PARAM]: returnPath });

  return `${SIGN_IN_PATH}?${query.toString()}`;
}

/**
 * Путь страницы с параметрами, но без отметки о неудачном входе: туда возвращаются после входа,
 * и туда же меняется адрес, когда сообщение о неудаче закрыли.
 * @param {string} pathname Путь страницы — `location.pathname`.
 * @param {string} search Параметры адреса — `location.search`.
 * @returns {string} Путь вида `/gallery/?user=alice`.
 */
export function pathWithoutSignInResult(pathname: string, search: string): string {
  const query = new URLSearchParams(search);

  query.delete(SIGN_IN_RESULT_PARAM);

  const rest = query.toString();

  return rest === "" ? pathname : `${pathname}?${rest}`;
}

/**
 * Вернул ли API браузер на сайт после неудачного входа.
 * @param {string} search Параметры адреса — `location.search`.
 * @returns {boolean} `true`, если в адресе `login=failed`.
 */
export function isSignInFailed(search: string): boolean {
  return new URLSearchParams(search).get(SIGN_IN_RESULT_PARAM) === SIGN_IN_FAILED;
}

/**
 * Адрес аватара автора на GitHub: API его не хранит, картинку отдаёт сам GitHub.
 * @param {string} login Логин автора на GitHub.
 * @returns {string} Адрес вида `https://github.com/alice.png?size=64`.
 */
export function avatarUrl(login: string): string {
  return `https://github.com/${encodeURIComponent(login)}.png?size=${AVATAR_SIZE}`;
}

/**
 * Адрес личного кабинета.
 * @param {Locale} locale Язык страницы.
 * @returns {string} Путь вида `/me/`, для русского — `/ru/me/`.
 */
export function cabinetUrl(locale: Locale): string {
  return localizedPath(locale, API_PAGES.cabinet);
}
