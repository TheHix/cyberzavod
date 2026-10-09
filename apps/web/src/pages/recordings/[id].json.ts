import type { APIRoute, GetStaticPaths } from "astro";
import type { SessionRecord } from "@cyberzavod/core";
import { publishedRecordings } from "@/entities/recording";

/**
 * A file per site recording. There is one for all languages and it lives outside `[...lang]`:
 * recordings are not translated. `recordingFileUrl` (`entities/recording-file`) builds the address.
 * @returns {object[]} Route parameters and the recording.
 */
export const getStaticPaths = (() =>
  publishedRecordings.map((recording) => ({
    params: { id: recording.id },
    props: { recording },
  }))) satisfies GetStaticPaths;

/**
 * A full build recording in JSON: the series journal on the home and project pages loads it lazily,
 * so the full texts of all recordings do not end up in the page markup. This is not a page: it does
 * not go into the sitemap.
 * @param {object} context Astro route context.
 * @param {object} context.props Props from `getStaticPaths`: the recording.
 * @returns {Response} The recording in JSON.
 */
export const GET: APIRoute<{ recording: SessionRecord }> = ({ props }) =>
  new Response(JSON.stringify(props.recording), {
    headers: { "Content-Type": "application/json" },
  });
