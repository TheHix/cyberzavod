import { For } from "solid-js";
import { summarize, type Recording } from "@cyberzavod/core";
import { formatDuration, formatTokens } from "@/shared/lib/format.ts";
import styles from "./BuildStats.module.css";

interface Props {
  recording: Recording;
}

// Без client:* на странице рендерится в статический HTML и не тянет JS.
export function BuildStats(props: Props) {
  const stats = () => summarize(props.recording);
  const items = () => [
    { label: "Время", value: formatDuration(stats().durationMs) },
    { label: "Токены", value: formatTokens(stats().tokens) },
    { label: "Промпты", value: String(stats().prompts) },
    { label: "Возвраты", value: String(stats().reworks) },
  ];

  return (
    <dl class={styles.stats}>
      <For each={items()}>
        {(item) => (
          <div class={styles.item}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        )}
      </For>
    </dl>
  );
}
