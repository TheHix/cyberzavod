import type { BriefMessageEvent, Speaker } from "@cyberzavod/core";
import { FOREMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";
import type { Locale } from "@/shared/i18n/locale.ts";

// Participant captions: stages as on the signs, the foreman in lowercase so that mid-route
// it reads as a word and at the start gets a capital letter.
function speakerLabel(speaker: Speaker, locale: Locale): string {
  return speaker === "foreman"
    ? FOREMAN_LABEL[locale].toLowerCase()
    : STAGE_LABELS[speaker][locale];
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Message route for the caption: who is talking to whom.
 * @param {BriefMessageEvent} message Message from the recording.
 * @param {Locale} locale Caption language.
 * @returns {string} E.g. «Код → Проверки» or «Постановка → мастер»; in English «Plan → foreman».
 */
export function routeOf(message: BriefMessageEvent, locale: Locale): string {
  return `${capitalized(speakerLabel(message.from, locale))} → ${speakerLabel(message.to, locale)}`;
}
