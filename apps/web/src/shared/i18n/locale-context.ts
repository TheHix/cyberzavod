import { createContext, useContext } from "solid-js";
import type { Locale } from "./locale.ts";

const LocaleContext = createContext<Locale>();

/** Отдаёт язык страницы компонентам острова: страница знает его при сборке и не меняет. */
export const LocaleProvider = LocaleContext.Provider;

/**
 * Язык страницы, внутри острова которой стоит компонент.
 * @returns {Locale} Язык страницы.
 * @throws {Error} Если компонент стоит вне `LocaleProvider`.
 */
export function useLocale(): Locale {
  const locale = useContext(LocaleContext);

  if (locale === undefined) throw new Error("компонент стоит вне LocaleProvider");

  return locale;
}
