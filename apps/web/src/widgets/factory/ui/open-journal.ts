import { PANELS } from "@/shared/config/panels.ts";

/**
 * Открывает панель журнала сборки и прокручивает её к записи.
 * @param {string} anchor id записи в журнале, например `message-3`.
 */
export function openJournalAt(anchor: string): void {
  document.getElementById(PANELS.journal)?.showPopover();
  // Запись прокручивается после открытия панели: у закрытой панели нет раскладки.
  document.getElementById(anchor)?.scrollIntoView({ block: "center" });
}
