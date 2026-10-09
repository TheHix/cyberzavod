// `cyberzavod gallery`: the author's recordings on the server, whether the gallery is public, the
// limit; open and close it.

import { CommandError } from "../errors.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import type { Me } from "../sharing/api.ts";
import { withToken } from "../sharing/authorization.ts";
import { badgeMarkdown, galleryLink, recordingLink } from "../sharing/links.ts";
import type { Sharing } from "../sharing/services.ts";

/** What to do with gallery access: open, close, or only show. */
export type GalleryAccess = "public" | "private" | "keep";

/**
 * Picks the access change from the command flags.
 * @param {boolean} isPublicRequested `--public` is given.
 * @param {boolean} isPrivateRequested `--private` is given.
 * @returns {GalleryAccess} What to do with access.
 * @throws {CommandError} If both flags are given.
 */
export function galleryAccessOf(
  isPublicRequested: boolean,
  isPrivateRequested: boolean,
): GalleryAccess {
  if (isPublicRequested && isPrivateRequested) {
    throw new CommandError((messages) => messages.errors.galleryAccessConflict);
  }

  if (isPublicRequested) return "public";
  if (isPrivateRequested) return "private";

  return "keep";
}

async function changeAccess(sharing: Sharing, token: string, access: GalleryAccess): Promise<Me> {
  if (access !== "keep") await sharing.api.setGalleryPublic(token, access === "public");

  return sharing.api.me(token);
}

function describeGallery(sharing: Sharing, me: Me, messages: CliMessages): string[] {
  const recordingLines = me.recordings.map((recording) => {
    const link = recordingLink(sharing.siteUrl, recording.slug);

    return `  ${recording.id}  ${recording.title}\n    ${link}`;
  });
  const recordingsTitle = messages.gallery.recordings({
    count: me.recordings.length,
    limit: me.limit,
  });

  if (!me.galleryPublic) {
    return [
      messages.gallery.closed(me.login),
      recordingsTitle,
      ...recordingLines,
      messages.gallery.openHint,
    ];
  }

  return [
    messages.gallery.open(me.login),
    recordingsTitle,
    ...recordingLines,
    messages.gallery.page(galleryLink(sharing.siteUrl, me.login)),
    messages.gallery.badge(badgeMarkdown(sharing.siteUrl, me.login)),
    messages.gallery.closeHint,
  ];
}

/**
 * Shows the author's gallery; if needed, opens or closes it first.
 * @param {Sharing} sharing Dependencies of the sharing commands.
 * @param {GalleryAccess} access What to do with gallery access.
 * @param {CliMessages} messages Messages in the chosen language.
 * @returns {Promise<void>} Done when the gallery state is printed.
 * @throws {CommandError} If not logged in.
 */
export async function showGallery(
  sharing: Sharing,
  access: GalleryAccess,
  messages: CliMessages,
): Promise<void> {
  const me = await withToken(sharing, (token) => changeAccess(sharing, token, access));

  for (const line of describeGallery(sharing, me, messages)) console.log(line);
}
