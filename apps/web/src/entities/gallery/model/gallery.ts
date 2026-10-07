import type { SessionRecord } from "@cyberzavod/core";

/** Запись в галерее автора — `Summary` из ответа API: без событий, со ссылкой по `slug`. */
export interface RecordingSummary {
  readonly id: string;
  /** Секретная часть ссылки на запись: `/r/?id=<slug>`. */
  readonly slug: string;
  readonly projectId: string;
  readonly title: string;
  /** Язык оригинала записи: код ISO 639. */
  readonly language: string;
  /** Начало сборки — `timestamp` записи. */
  readonly startedAt: string;
  readonly uploadedAt: string;
}

/** Открытая галерея в общем списке: автор, сколько у него записей и когда галерея менялась. */
export interface GalleryListing {
  readonly login: string;
  readonly recordingCount: number;
  readonly updatedAt: string;
}

/** Открытая галерея автора: его записи, свежие сверху. */
export interface Gallery {
  readonly login: string;
  readonly recordings: readonly RecordingSummary[];
}

/** Запись из галереи по секретной ссылке: сама сессия, её автор и открыта ли его галерея. */
export interface SharedRecording {
  readonly owner: string;
  readonly galleryPublic: boolean;
  readonly record: SessionRecord;
}
