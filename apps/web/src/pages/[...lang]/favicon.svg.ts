import type { APIRoute, GetStaticPaths } from "astro";
import { LOCALES, type Locale } from "@/shared/i18n/locale.ts";
import { localeParam } from "@/shared/i18n/path.ts";
import { faviconSvg } from "@/shared/lib/site-images.ts";

/**
 * Картинка на каждый язык: у языка по умолчанию — в корне, у остальных — под префиксом языка.
 * @returns {object[]} Параметры маршрута и язык картинки.
 */
export const getStaticPaths = (() =>
  LOCALES.map((locale) => ({
    params: { lang: localeParam(locale) },
    props: { locale },
  }))) satisfies GetStaticPaths;

/**
 * Иконка вкладки на языке страниц.
 * @param {object} context Контекст маршрута Astro.
 * @param {object} context.props Свойства из `getStaticPaths`: язык.
 * @returns {Response} Картинка SVG.
 */
export const GET: APIRoute<{ locale: Locale }> = ({ props }) =>
  new Response(faviconSvg(props.locale), { headers: { "Content-Type": "image/svg+xml" } });
