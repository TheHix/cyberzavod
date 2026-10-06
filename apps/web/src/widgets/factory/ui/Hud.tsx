import type { JSX } from "solid-js";
import type { BriefRecording } from "@cyberzavod/core";
import type { ProjectLink } from "@/entities/project";
import { useLocale } from "@/shared/i18n/locale-context.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
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
  const locale = useLocale();
  const stats = () => [
    { label: UI_TEXT.hud.time[locale], value: formatDuration(model.summary.durationMs, locale) },
    { label: UI_TEXT.hud.tokens[locale], value: formatTokens(model.summary.tokens, locale) },
    { label: UI_TEXT.hud.prompts[locale], value: String(model.summary.prompts) },
    { label: UI_TEXT.hud.reworks[locale], value: String(model.summary.reworks) },
    { label: UI_TEXT.hud.interventions[locale], value: String(model.summary.interventions) },
  ];

  return (
    <Panel label={UI_TEXT.hud.label[locale]} class={styles.hud}>
      <header class={styles.header}>
        <Title as={props.titleLevel} size="xl">
          {props.recording.title}
        </Title>
        <p class={styles.date}>
          <ButtonLink variant="link" href={props.project.url}>
            {props.project.name}
          </ButtonLink>{" "}
          · {formatDate(props.recording.startedAt, locale)}
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
