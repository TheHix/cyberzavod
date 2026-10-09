import { interventionAnchor } from "@/entities/intervention";
import { messageAnchor } from "@/entities/message";
import { PANELS } from "@/shared/config/panels.ts";
import type { FactoryModel } from "../model/factory.ts";

// The series journal is an island, and the full recording comes into it as a file: right after a
// click the entry may not be in the journal yet. The journal waits this long for it to scroll to
// it.
const ENTRY_WAIT_MS = 10_000;

// The entry goes to the top of the journal, not the middle: a long message is taller than the
// panel, and in the middle its header and the start of the text would go past the top edge.
const ENTRY_ALIGNMENT: ScrollIntoViewOptions = { block: "start" };

// Scrolls the journal to the entry; if it is not there yet, waits until the journal shows it.
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
 * Opens the build journal panel and scrolls it to the entry as soon as the entry is in the journal.
 * @param {string} anchor Entry id in the journal, e.g. `message-3`.
 */
export function openJournalAt(anchor: string): void {
  const panel = document.getElementById(PANELS.journal);

  if (panel === null) return;

  if (panel.matches(":popover-open")) {
    scrollToEntry(panel, anchor);

    return;
  }

  // The entry scrolls once the panel has opened: a closed panel has no layout, and on opening the
  // series journal puts the new build at the start, so scrolling to the entry must come after it.
  panel.addEventListener("toggle", () => scrollToEntry(panel, anchor), { once: true });
  panel.showPopover();
}

/**
 * Shows the full text of a message: pauses the floor so it can be read, and opens the journal at
 * this message.
 * @param {FactoryModel} model The factory model to stop.
 * @param {number} index Message number in the recording (`MessageCue.index`).
 */
export function showMessageDetails(model: FactoryModel, index: number): void {
  model.pause();
  openJournalAt(messageAnchor(index));
}

/**
 * Shows the full text of an intervention: pauses the floor so it can be read, and opens the
 * journal at this intervention.
 * @param {FactoryModel} model The factory model to stop.
 * @param {number} index Intervention number in the recording (`InterventionCue.index`).
 */
export function showInterventionDetails(model: FactoryModel, index: number): void {
  model.pause();
  openJournalAt(interventionAnchor(index));
}
