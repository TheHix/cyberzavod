// The series journal changes the build in the same panel. The browser remembers the scroll even
// for a closed panel, and it cannot be set while closed: without this the new build would open in
// the middle of the text, where the previous one was being read.

import type { ReadableAtom } from "nanostores";

// The nearest ancestor that scrolls the journal is the body of the sliding panel.
function scrollContainerOf(journal: HTMLElement): HTMLElement | null {
  for (let node = journal.parentElement; node !== null; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    const isScrollable = overflowY === "auto" || overflowY === "scroll";

    if (isScrollable) return node;
  }

  return null;
}

/**
 * Shows a new build in the journal from the start: right away if the panel is open, otherwise when
 * it opens. A build already seen stays where it was being read.
 * @param {HTMLElement} journal Journal inside the sliding panel.
 * @param {ReadableAtom<string | undefined>} $recordingId Id of the build in the journal; absent
 *   while there is none.
 * @returns {() => void} Stops following.
 */
export function showNewRecordingsFromStart(
  journal: HTMLElement,
  $recordingId: ReadableAtom<string | undefined>,
): () => void {
  const panel = journal.closest("[popover]");
  let seenRecordingId: string | undefined;

  const showFromStartIfNew = () => {
    const recordingId = $recordingId.get();
    const container = scrollContainerOf(journal);
    const isSeen = recordingId === seenRecordingId;
    // A closed panel has no layout: its scroll cannot be set, and nobody sees the build there.
    const isShown = journal.getClientRects().length > 0;

    if (container === null || isSeen || !isShown) return;

    seenRecordingId = recordingId;
    container.scrollTop = 0;
  };
  const stopFollowing = $recordingId.listen(showFromStartIfNew);

  panel?.addEventListener("toggle", showFromStartIfNew);

  return () => {
    stopFollowing();
    panel?.removeEventListener("toggle", showFromStartIfNew);
  };
}
