import type { JSX } from "solid-js";
import type { BriefRecording } from "@cyberzavod/core";
import type { ProjectLink } from "@/entities/project";
import { formatDate, formatDuration, formatTokens } from "@/shared/lib/format.ts";
import { ButtonLink, Panel, StatList, Title } from "@/shared/ui";
import { useFactoryModel } from "./model-context.ts";
import { PlaybackControls } from "./PlaybackControls.tsx";
import { SpeechDock } from "./SpeechDock.tsx";
import styles from "./Hud.module.css";

interface Props {
  recording: BriefRecording;
  /** Проект, который собирали: ссылка на него стоит рядом с датой. */
  project: ProjectLink;
  /** Уровень заголовка: на странице записи это главный заголовок, на главной — нет. */
  titleLevel: "h1" | "h2";
}

/**
 * HUD цеха: какая сборка идёт, к какому она проекту, её итоги и управление проигрыванием. На
 * широком экране он справа, на узком и низком — под полем, и в нём вместо пузырей над станками
 * полка речи.
 * @param {Props} props Свойства компонента.
 * @param {BriefRecording} props.recording Запись, которую проигрывает цех.
 * @param {ProjectLink} props.project Проект, который собирали.
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
      <header class={styles.header}>
        <Title as={props.titleLevel} size="xl">
          {props.recording.title}
        </Title>
        <p class={styles.date}>
          <ButtonLink variant="link" href={props.project.url}>
            {props.project.name}
          </ButtonLink>{" "}
          · {formatDate(props.recording.startedAt)}
        </p>
      </header>
      <div class={styles.stats}>
        <StatList items={stats()} />
      </div>
      <div class={styles.speech}>
        <SpeechDock title={props.recording.title} />
      </div>
      <PlaybackControls />
    </Panel>
  );
}
