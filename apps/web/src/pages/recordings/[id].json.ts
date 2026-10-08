import type { APIRoute, GetStaticPaths } from "astro";
import type { SessionRecord } from "@cyberzavod/core";
import { publishedRecordings } from "@/entities/recording";

/**
 * Файл на каждую запись сайта. Он один на все языки и лежит вне `[...lang]`: запись не
 * переводится. Адрес собирает `recordingFileUrl` (`entities/recording-file`).
 * @returns {object[]} Параметры маршрута и запись.
 */
export const getStaticPaths = (() =>
  publishedRecordings.map((recording) => ({
    params: { id: recording.id },
    props: { recording },
  }))) satisfies GetStaticPaths;

/**
 * Полная запись сборки в JSON — её лениво грузит журнал серии на главной и на странице проекта,
 * чтобы полные тексты всех записей не попадали в разметку страницы. Это не страница: в карту
 * сайта она не идёт.
 * @param {object} context Контекст маршрута Astro.
 * @param {object} context.props Свойства из `getStaticPaths`: запись.
 * @returns {Response} Запись в JSON.
 */
export const GET: APIRoute<{ recording: SessionRecord }> = ({ props }) =>
  new Response(JSON.stringify(props.recording), {
    headers: { "Content-Type": "application/json" },
  });
