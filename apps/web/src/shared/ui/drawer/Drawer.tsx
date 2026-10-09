import X from "lucide-solid/icons/x";
import type { JSX } from "solid-js";
import { Button } from "../button/Button.tsx";
import styles from "./Drawer.module.css";

const ICON_STROKE = 3;

interface Props {
  /** Panel id: the buttons that open it reference it (`popovertarget`). */
  id: string;
  title: string;
  /** Close button label in the page language: the kit does not know the dictionary. */
  closeLabel: string;
  children: JSX.Element;
}

/**
 * ui-kit slide-out panel on a native popover: without JS it opens from a button with
 * `popovertarget`, closes by Esc or a click outside, and its content is always in the HTML.
 * @param {Props} props Component props.
 * @param {string} props.id Panel id.
 * @param {string} props.title Panel title.
 * @param {string} props.closeLabel Close button label.
 * @param {JSX.Element} props.children Content.
 * @returns {JSX.Element} Panel, hidden until opened.
 */
export function Drawer(props: Props): JSX.Element {
  const titleId = () => `${props.id}-title`;

  return (
    <aside id={props.id} popover="auto" class={styles.drawer} aria-labelledby={titleId()}>
      <header class={styles.header}>
        <h2 id={titleId()} class={styles.title}>
          {props.title}
        </h2>
        <Button
          layout="icon"
          popovertarget={props.id}
          popovertargetaction="hide"
          aria-label={props.closeLabel}
        >
          <X stroke-width={ICON_STROKE} />
        </Button>
      </header>
      <div class={styles.body}>{props.children}</div>
    </aside>
  );
}
