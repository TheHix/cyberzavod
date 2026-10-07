import { Show, type JSX } from "solid-js";
import type { BriefSessionRecord } from "@cyberzavod/core";
import { useLocale } from "@/shared/i18n/locale-context.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatDate, formatDuration, formatTokens } from "@/shared/lib/format.ts";
import { ButtonLink, Panel, StatList, Title } from "@/shared/ui";
import { useFactoryModel } from "./model-context.ts";
import { PlaybackControls } from "./PlaybackControls.tsx";
import { SpeechDock } from "./SpeechDock.tsx";
import styles from "./Hud.module.css";

/**
 * Проект сборки в HUD: название и адрес, если есть куда вести, — страница проекта (`ProjectLink`)
 * или галерея автора записи; у записи из закрытой галереи адреса нет.
 */
export interface BuildProject {
  readonly name: string;
  readonly url: string | undefined;
}

interface Props {
  recording: BriefSessionRecord;
  /** Проект, который собирали: он стоит рядом с датой. */
  project: BuildProject;
  /** Пометка о языке оригинала записи рядом с датой; нет, если запись на языке страницы. */
  languageNote: string | undefined;
  /** Уровень заголовка: на странице записи это главный заголовок, на главной — нет. */
  titleLevel: "h1" | "h2";
}

/**
 * HUD цеха: какая сборка идёт, к какому она проекту, её итоги и управление проигрыванием. На
 * широком экране он справа, на узком и низком — под полем, и в нём вместо пузырей над станками
 * полка речи.
 * @param {Props} props Свойства компонента.
 * @param {BriefSessionRecord} props.recording Запись, которую проигрывает цех.
 * @param {BuildProject} props.project Проект, который собирали.
 * @param {string | undefined} props.languageNote Пометка о языке оригинала записи.
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
        <Title as={props.titleLevel} size="xl" lang={props.recording.data.language}>
          {props.recording.data.title}
        </Title>
        <p class={styles.date}>
          <Show when={props.project.url} fallback={props.project.name}>
            {(url) => (
              <ButtonLink variant="link" href={url()}>
                {props.project.name}
              </ButtonLink>
            )}
          </Show>{" "}
          · {formatDate(props.recording.timestamp, locale)}
          <Show when={props.languageNote}>{(note) => ` · ${note()}`}</Show>
        </p>
      </header>
      <div class={styles.stats}>
        <StatList items={stats()} />
      </div>
      <div class={styles.speech}>
        <SpeechDock title={props.recording.data.title} />
      </div>
      <PlaybackControls />
    </Panel>
  );
}
