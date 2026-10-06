import { interventionAnchor } from "@/entities/intervention";
import { messageAnchor } from "@/entities/message";
import { PANELS } from "@/shared/config/panels.ts";
import type { FactoryModel } from "../model/factory.ts";

/**
 * Открывает панель журнала сборки и прокручивает её к записи.
 * @param {string} anchor id записи в журнале, например `message-3`.
 */
export function openJournalAt(anchor: string): void {
  document.getElementById(PANELS.journal)?.showPopover();
  // Запись прокручивается после открытия панели: у закрытой панели нет раскладки.
  document.getElementById(anchor)?.scrollIntoView({ block: "center" });
}

/**
 * Показывает полный текст реплики: ставит цех на паузу, чтобы его прочитать, и открывает
 * журнал на этой реплике.
 * @param {FactoryModel} model Модель цеха, которую нужно остановить.
 * @param {number} index Номер реплики в записи (`MessageCue.index`).
 */
export function showMessageDetails(model: FactoryModel, index: number): void {
  model.pause();
  openJournalAt(messageAnchor(index));
}

/**
 * Показывает полный текст вмешательства: ставит цех на паузу, чтобы его прочитать, и открывает
 * журнал на этом вмешательстве.
 * @param {FactoryModel} model Модель цеха, которую нужно остановить.
 * @param {number} index Номер вмешательства в записи (`InterventionCue.index`).
 */
export function showInterventionDetails(model: FactoryModel, index: number): void {
  model.pause();
  openJournalAt(interventionAnchor(index));
}
