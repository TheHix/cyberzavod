import Check from "lucide-solid/icons/check";
import Copy from "lucide-solid/icons/copy";
import X from "lucide-solid/icons/x";
import { createSignal, onCleanup, type Component, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Button } from "../button/Button.tsx";

type CopyState = "idle" | "copied" | "failed";

/** Copy button labels per state: idle, copied, failed. */
export type CopyLabels = Readonly<Record<CopyState, string>>;

interface Props {
  /** Text to copy; read at the moment of the click, not when the button is shown. */
  text: () => string;
  /** Labels per state in the page language: the kit does not know the dictionary. */
  labels: CopyLabels;
}

/** How long the button shows the copy result before returning to its idle look. */
const COPY_FEEDBACK_MS = 2000;
const ICON_STROKE = 3;

const ICONS: Record<CopyState, Component<{ "stroke-width": number }>> = {
  idle: Copy,
  copied: Check,
  failed: X,
};

/**
 * ui-kit copy button: puts text on the clipboard and for a couple of seconds shows the result,
 * success or failure.
 * @param {Props} props Component props.
 * @param {() => string} props.text Text to copy, read at the moment of the click.
 * @param {CopyLabels} props.labels Button labels per state.
 * @returns {JSX.Element} Icon button and a hidden status with the result for screen readers.
 */
export function CopyButton(props: Props): JSX.Element {
  const [state, setState] = createSignal<CopyState>("idle");
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const showResult = (result: CopyState) => {
    clearTimeout(resetTimer);
    setState(result);
    resetTimer = setTimeout(() => setState("idle"), COPY_FEEDBACK_MS);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.text());
    } catch (err) {
      console.error("копирование в буфер обмена не удалось", err);
      showResult("failed");

      return;
    }

    showResult("copied");
  };

  onCleanup(() => clearTimeout(resetTimer));

  // Screen readers often do not announce an aria-label change on a focused button, so a
  // separate status announces the result.
  return (
    <>
      <Button
        layout="icon"
        variant={state() === "copied" ? "primary" : "secondary"}
        aria-label={props.labels[state()]}
        title={props.labels[state()]}
        onClick={() => void copy()}
      >
        <Dynamic component={ICONS[state()]} stroke-width={ICON_STROKE} />
      </Button>
      <span class="visually-hidden" role="status">
        {state() === "idle" ? "" : props.labels[state()]}
      </span>
    </>
  );
}
