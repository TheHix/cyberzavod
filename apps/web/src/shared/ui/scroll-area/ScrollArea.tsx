import { createSignal, onCleanup, type JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./ScrollArea.module.css";

interface Props {
  /** Height and layout from outside: a height limit or a place in a flex column, gaps. */
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * ui-kit paper block whose content scrolls inside when it does not fit the height given to it
 * from outside: the wheel, a finger and the keyboard scroll it rather than the page. A shadow at
 * the edge shows there is more text beyond it.
 * @param {Props} props Component props.
 * @param {string} [props.class] Height and layout from outside.
 * @param {JSX.Element} props.children Content.
 * @returns {JSX.Element} Scrollable block.
 */
export function ScrollArea(props: Props): JSX.Element {
  const [isOverflowing, setOverflowing] = createSignal(false);

  // Content can change without the block resizing (a list expanded while the block is already
  // at its height limit), so a MutationObserver watches it too.
  const watchOverflow = (area: HTMLDivElement) => {
    const checkOverflow = () => setOverflowing(area.scrollHeight > area.clientHeight);
    const resizes = new ResizeObserver(checkOverflow);
    const mutations = new MutationObserver(checkOverflow);

    resizes.observe(area);
    mutations.observe(area, { childList: true, subtree: true, characterData: true });
    onCleanup(() => {
      resizes.disconnect();
      mutations.disconnect();
    });
  };

  return (
    <div
      ref={watchOverflow}
      class={cx(styles.area, props.class)}
      // Without links or buttons inside, the block would never get focus and could not be
      // scrolled from the keyboard; while there is nothing to scroll, it is no extra Tab stop.
      tabindex={isOverflowing() ? 0 : undefined}
      data-overflowing={isOverflowing() ? "" : undefined}
    >
      {props.children}
    </div>
  );
}
