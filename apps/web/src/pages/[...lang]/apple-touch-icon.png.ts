import type { APIRoute, GetStaticPaths } from "astro";
import { LOCALES, type Locale } from "@/shared/i18n/locale.ts";
import { localeParam } from "@/shared/i18n/path.ts";
import { touchIconPng } from "@/shared/lib/site-images.ts";

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
 * Иконка для экрана «Домой» на языке страниц.
 * @param {object} context Контекст маршрута Astro.
 * @param {object} context.props Свойства из `getStaticPaths`: язык.
 * @returns {Promise<Response>} Картинка PNG.
 */
export const GET: APIRoute<{ locale: Locale }> = async ({ props }) => {
  const icon = await touchIconPng(props.locale);

  return new Response(icon, { headers: { "Content-Type": "image/png" } });
};
