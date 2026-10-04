import { For, type JSX } from "solid-js";
import { summarize, type Recording } from "@cyberzavod/core";
import { formatDuration, formatTokens } from "@/shared/lib/format.ts";
import styles from "./BuildStats.module.css";

interface Props {
  recording: Recording;
}

/**
 * Счётчики сборки: время, токены, промпты и возвраты на доработку.
 * Без client:* на странице рендерится в статический HTML и не тянет JS.
 * @param {Props} props Свойства компонента.
 * @param {Recording} props.recording Запись сборки, по которой считаются счётчики.
 * @returns {JSX.Element} Список счётчиков.
 */
export function BuildStats(props: Props): JSX.Element {
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
