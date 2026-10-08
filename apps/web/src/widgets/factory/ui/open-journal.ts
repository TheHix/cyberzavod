import { interventionAnchor } from "@/entities/intervention";
import { messageAnchor } from "@/entities/message";
import { PANELS } from "@/shared/config/panels.ts";
import type { FactoryModel } from "../model/factory.ts";

// Журнал серии — остров, и полная запись приходит в него файлом: сразу после нажатия записи в
// журнале может ещё не быть. Столько журнал ждёт её, чтобы прокрутить к ней.
const ENTRY_WAIT_MS = 10_000;

// Запись встаёт к верху журнала, а не в середину: длинная реплика выше панели, и посередине её
// шапка и начало текста ушли бы за верхний край.
const ENTRY_ALIGNMENT: ScrollIntoViewOptions = { block: "start" };

// Прокручивает журнал к записи; если её ещё нет, ждёт, пока журнал её покажет.
function scrollToEntry(panel: HTMLElement, anchor: string): void {
  const entry = document.getElementById(anchor);

  if (entry !== null) {
    entry.scrollIntoView(ENTRY_ALIGNMENT);

    return;
  }

  const observer = new MutationObserver(() => {
    const shownEntry = document.getElementById(anchor);

    if (shownEntry === null) return;

    observer.disconnect();
    shownEntry.scrollIntoView(ENTRY_ALIGNMENT);
  });

  observer.observe(panel, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), ENTRY_WAIT_MS);
}

/**
 * Открывает панель журнала сборки и прокручивает её к записи, как только запись в журнале есть.
 * @param {string} anchor id записи в журнале, например `message-3`.
 */
export function openJournalAt(anchor: string): void {
  const panel = document.getElementById(PANELS.journal);

  if (panel === null) return;

  if (panel.matches(":popover-open")) {
    scrollToEntry(panel, anchor);

    return;
  }

  // Запись прокручивается, когда панель открылась: у закрытой панели нет раскладки, а журнал
  // серии при открытии ставит новую сборку в начало — прокрутка к записи должна идти после него.
  panel.addEventListener("toggle", () => scrollToEntry(panel, anchor), { once: true });
  panel.showPopover();
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
