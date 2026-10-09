// Links to site pages the CLI shows to the human.

// The badge label is the same as in the Markdown line on the gallery page of the site.
const BADGE_ALT = "Built at Cyberzavod";

/**
 * Secret link to a recording: works in a private gallery too.
 * @param {string} siteUrl Server address without a trailing "/".
 * @param {string} slug Random recording id on the server.
 * @returns {string} Link to the recording page.
 */
export function recordingLink(siteUrl: string, slug: string): string {
  return `${siteUrl}/r/?id=${encodeURIComponent(slug)}`;
}

/**
 * The author's gallery page.
 * @param {string} siteUrl Server address without a trailing "/".
 * @param {string} login The author's GitHub login.
 * @returns {string} Link to the gallery.
 */
export function galleryLink(siteUrl: string, login: string): string {
  return `${siteUrl}/gallery/?user=${encodeURIComponent(login)}`;
}

/**
 * Gallery badge for a README in Markdown: an image linking to the gallery.
 * @param {string} siteUrl Server address without a trailing "/".
 * @param {string} login The author's GitHub login.
 * @returns {string} A Markdown line.
 */
export function badgeMarkdown(siteUrl: string, login: string): string {
  const badge = `${siteUrl}/api/badges/${encodeURIComponent(login)}.svg`;

  return `[![${BADGE_ALT}](${badge})](${galleryLink(siteUrl, login)})`;
}
