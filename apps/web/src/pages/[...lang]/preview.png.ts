import type { APIRoute, GetStaticPaths } from "astro";
import { LOCALES, type Locale } from "@/shared/i18n/locale.ts";
import { localeParam } from "@/shared/i18n/path.ts";
import { previewImagePng } from "@/shared/lib/site-images.ts";

/**
 * One image per language: the default language at the root, the others under a language prefix.
 * @returns {object[]} Route parameters and the image language.
 */
export const getStaticPaths = (() =>
  LOCALES.map((locale) => ({
    params: { lang: localeParam(locale) },
    props: { locale },
  }))) satisfies GetStaticPaths;

/**
 * Site link preview (`og:image`) in the pages' language.
 * @param {object} context Astro route context.
 * @param {object} context.props Props from `getStaticPaths`: the language.
 * @returns {Promise<Response>} PNG image.
 */
export const GET: APIRoute<{ locale: Locale }> = async ({ props }) => {
  const preview = await previewImagePng(props.locale);

  return new Response(preview, { headers: { "Content-Type": "image/png" } });
};
