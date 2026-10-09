/**
 * Address of a full site recording in JSON: a file the site builds from the journal at build time
 * (`src/pages/recordings/[id].json.ts`). One for all languages: recordings are not translated.
 * @param {string} id Recording id, the file name in the journal.
 * @returns {string} Path from the site root: `/recordings/<id>.json`.
 */
export function recordingFileUrl(id: string): string {
  return `/recordings/${encodeURIComponent(id)}.json`;
}
