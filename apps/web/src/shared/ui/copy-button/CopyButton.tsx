import Check from "lucide-solid/icons/check";
import Copy from "lucide-solid/icons/copy";
import X from "lucide-solid/icons/x";
import { createSignal, onCleanup, type Component, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Button } from "../button/Button.tsx";

type CopyState = "idle" | "copied" | "failed";

interface Props {
  /** Текст для копирования; читается в момент нажатия, а не при показе кнопки. */
  text: () => string;
}

/** Сколько кнопка показывает итог копирования, прежде чем вернуться в обычный вид. */
const COPY_FEEDBACK_MS = 2000;
const ICON_STROKE = 3;

const ICONS: Record<CopyState, Component<{ "stroke-width": number }>> = {
  idle: Copy,
  copied: Check,
  failed: X,
};

const LABELS: Record<CopyState, string> = {
  idle: "Копировать код",
  copied: "Скопировано",
  failed: "Не удалось скопировать",
};

/**
 * Кнопка «копировать» ui-kit: кладёт текст в буфер обмена и на пару секунд показывает итог —
 * «Скопировано» или «Не удалось скопировать».
 * @param {Props} props Свойства компонента.
 * @param {() => string} props.text Текст для копирования, читается в момент нажатия.
 * @returns {JSX.Element} Кнопка-иконка и скрытый статус с итогом для экранных дикторов.
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

  // Смену aria-label у кнопки в фокусе экранные дикторы часто не произносят — итог
  // объявляет отдельный статус.
  return (
    <>
      <Button
        layout="icon"
        variant={state() === "copied" ? "primary" : "secondary"}
        aria-label={LABELS[state()]}
        title={LABELS[state()]}
        onClick={() => void copy()}
      >
        <Dynamic component={ICONS[state()]} stroke-width={ICON_STROKE} />
      </Button>
      <span class="visually-hidden" role="status">
        {state() === "idle" ? "" : LABELS[state()]}
      </span>
    </>
  );
}
