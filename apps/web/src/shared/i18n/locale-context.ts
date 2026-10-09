import { createContext, useContext } from "solid-js";
import type { Locale } from "./locale.ts";

const LocaleContext = createContext<Locale>();

/** Gives island components the page language: the page knows it at build time and keeps it. */
export const LocaleProvider = LocaleContext.Provider;

/**
 * Language of the page whose island holds the component.
 * @returns {Locale} Page language.
 * @throws {Error} If the component is outside `LocaleProvider`.
 */
export function useLocale(): Locale {
  const locale = useContext(LocaleContext);

  if (locale === undefined) throw new Error("компонент стоит вне LocaleProvider");

  return locale;
}
