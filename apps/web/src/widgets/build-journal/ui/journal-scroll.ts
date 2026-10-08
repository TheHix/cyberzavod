// Журнал серии меняет сборку в той же панели. Браузер помнит прокрутку и у закрытой панели, а
// задать её закрытой нельзя: без этого новая сборка открылась бы посреди текста — там, где
// читали прежнюю.

import type { ReadableAtom } from "nanostores";

// Ближайший предок, который прокручивает журнал, — тело выезжающей панели.
function scrollContainerOf(journal: HTMLElement): HTMLElement | null {
  for (let node = journal.parentElement; node !== null; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    const isScrollable = overflowY === "auto" || overflowY === "scroll";

    if (isScrollable) return node;
  }

  return null;
}

/**
 * Показывает новую сборку в журнале с начала: сразу, если панель открыта, иначе — когда её
 * откроют. Сборку, которую уже видели, журнал оставляет там, где её читали.
 * @param {HTMLElement} journal Журнал внутри выезжающей панели.
 * @param {ReadableAtom<string | undefined>} $recordingId id сборки в журнале; нет, пока её нет.
 * @returns {() => void} Перестаёт следить.
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
    // У закрытой панели нет раскладки: прокрутку ей задать нельзя, и сборку там никто не видит.
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
