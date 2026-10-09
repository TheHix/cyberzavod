import { API_PAGES } from "@/shared/config/routes.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { localizedPath } from "@/shared/i18n/path.ts";

/** GitHub sign-in starts in the API: a plain link, not a request, then OAuth redirects follow. */
const SIGN_IN_PATH = "/api/auth/github/login";
/** Parameter in which the API receives the path to return the browser to after sign-in. */
const RETURN_PARAM = "return";
/** Parameter and value with which the API returns after a failed sign-in: `/?login=failed`. */
const SIGN_IN_RESULT_PARAM = "login";
const SIGN_IN_FAILED = "failed";
/** GitHub avatar size in pixels: with headroom for high-density screens. */
const AVATAR_SIZE = 64;

/**
 * The address where GitHub sign-in starts.
 * @param {string} returnPath Site path with parameters to return to after sign-in.
 * @returns {string} A path like `/api/auth/github/login?return=%2Fru%2Fme%2F`.
 */
export function signInUrl(returnPath: string): string {
  const query = new URLSearchParams({ [RETURN_PARAM]: returnPath });

  return `${SIGN_IN_PATH}?${query.toString()}`;
}

/**
 * Page path with parameters but without the failed sign-in mark: sign-in returns there, and the
 * address changes to it when the failure message is closed.
 * @param {string} pathname Page path, `location.pathname`.
 * @param {string} search Address parameters, `location.search`.
 * @returns {string} A path like `/gallery/?user=alice`.
 */
export function pathWithoutSignInResult(pathname: string, search: string): string {
  const query = new URLSearchParams(search);

  query.delete(SIGN_IN_RESULT_PARAM);

  const rest = query.toString();

  return rest === "" ? pathname : `${pathname}?${rest}`;
}

/**
 * Whether the API returned the browser to the site after a failed sign-in.
 * @param {string} search Address parameters, `location.search`.
 * @returns {boolean} `true` if the address has `login=failed`.
 */
export function isSignInFailed(search: string): boolean {
  return new URLSearchParams(search).get(SIGN_IN_RESULT_PARAM) === SIGN_IN_FAILED;
}

/**
 * The author's GitHub avatar address: the API does not store it, GitHub serves the image itself.
 * @param {string} login Author's GitHub login.
 * @returns {string} An address like `https://github.com/alice.png?size=64`.
 */
export function avatarUrl(login: string): string {
  return `https://github.com/${encodeURIComponent(login)}.png?size=${AVATAR_SIZE}`;
}

/**
 * The account page address.
 * @param {Locale} locale Page language.
 * @returns {string} A path like `/me/`, for Russian `/ru/me/`.
 */
export function cabinetUrl(locale: Locale): string {
  return localizedPath(locale, API_PAGES.cabinet);
}
