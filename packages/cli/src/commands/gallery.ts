// `cyberzavod gallery`: записи автора на сервере, открыта ли галерея, лимит; открыть и закрыть.

import { CommandError } from "../errors.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import type { Me } from "../sharing/api.ts";
import { withToken } from "../sharing/authorization.ts";
import { badgeMarkdown, galleryLink, recordingLink } from "../sharing/links.ts";
import type { Sharing } from "../sharing/services.ts";

/** Что делать с доступом к галерее: открыть, закрыть или только показать. */
export type GalleryAccess = "public" | "private" | "keep";

/**
 * Выбирает изменение доступа по флагам команды.
 * @param {boolean} isPublicRequested Указан `--public`.
 * @param {boolean} isPrivateRequested Указан `--private`.
 * @returns {GalleryAccess} Что делать с доступом.
 * @throws {CommandError} Если указаны оба флага.
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
 * Показывает галерею автора; при необходимости сначала открывает или закрывает её.
 * @param {Sharing} sharing Зависимости команд публикации.
 * @param {GalleryAccess} access Что делать с доступом к галерее.
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {Promise<void>} Готово, когда состояние галереи напечатано.
 * @throws {CommandError} Если нет входа.
 */
export async function showGallery(
  sharing: Sharing,
  access: GalleryAccess,
  messages: CliMessages,
): Promise<void> {
  const me = await withToken(sharing, (token) => changeAccess(sharing, token, access));

  for (const line of describeGallery(sharing, me, messages)) console.log(line);
}
