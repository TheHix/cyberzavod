import type { JSX } from "solid-js";
import type { Recording } from "@cyberzavod/core";
import { formatDate, formatDuration, formatTokens } from "@/shared/lib/format.ts";
import { Panel, StatList, Title } from "@/shared/ui";
import { useFactoryModel } from "./model-context.ts";
import { PlaybackControls } from "./PlaybackControls.tsx";
import styles from "./Hud.module.css";

interface Props {
  recording: Recording;
  /** Уровень заголовка: на странице записи это главный заголовок, на главной — нет. */
  titleLevel: "h1" | "h2";
}

/**
 * HUD цеха справа: какая сборка идёт, её итоги и управление проигрыванием.
 * @param {Props} props Свойства компонента.
 * @param {Recording} props.recording Запись, которую проигрывает цех.
 * @param {"h1" | "h2"} props.titleLevel Уровень заголовка с названием сборки.
 * @returns {JSX.Element} Панель сборки.
 */
export function Hud(props: Props): JSX.Element {
  const model = useFactoryModel();
  const stats = () => [
    { label: "Время", value: formatDuration(model.summary.durationMs) },
    { label: "Токены", value: formatTokens(model.summary.tokens) },
    { label: "Промпты", value: String(model.summary.prompts) },
    { label: "Возвраты", value: String(model.summary.reworks) },
  ];

  return (
    <Panel label="Сборка" class={styles.hud}>
      <header>
        <Title as={props.titleLevel} size="xl">
          {props.recording.title}
        </Title>
        <p class={styles.date}>{formatDate(props.recording.startedAt)}</p>
      </header>
      <div class={styles.stats}>
        <StatList items={stats()} />
      </div>
      <PlaybackControls />
    </Panel>
  );
}
