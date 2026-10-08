import { For, Show, type JSX } from "solid-js";
import { useLocale } from "@/shared/i18n/locale-context.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatDate, formatDuration, formatTokens } from "@/shared/lib/format.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { ButtonLink, Panel, StatList, Title } from "@/shared/ui";
import type { BuildProject } from "../lib/build-project.ts";
import type { SeriesPosition } from "../lib/series-builds.ts";
import { useFactoryModel } from "./model-context.ts";
import { PlaybackControls } from "./PlaybackControls.tsx";
import { SpeechDock } from "./SpeechDock.tsx";
import styles from "./Hud.module.css";

interface Props {
  /** Проект, который собирали: он стоит рядом с датой. */
  project: BuildProject;
  /** Пометка о языке оригинала записи рядом с датой; нет, если запись на языке страницы. */
  languageNote: string | undefined;
  /** Место сборки в серии её проекта рядом с проектом; нет у одиночной записи. */
  position: SeriesPosition | undefined;
  /** Уровень заголовка: на странице записи это главный заголовок, на главной — нет. */
  titleLevel: "h1" | "h2";
}

/**
 * HUD цеха: какая сборка идёт, к какому она проекту, её итоги и управление проигрыванием. Запись
 * и итоги берёт из модели цеха: в серии они меняются вместе со сборкой. На широком экране он
 * справа, на узком и низком — под полем, и в нём вместо пузырей над станками полка речи.
 * @param {Props} props Свойства компонента.
 * @param {BuildProject} props.project Проект, который собирали.
 * @param {string | undefined} props.languageNote Пометка о языке оригинала записи.
 * @param {SeriesPosition | undefined} props.position Место сборки в серии её проекта.
 * @param {"h1" | "h2"} props.titleLevel Уровень заголовка с названием сборки.
 * @returns {JSX.Element} Панель сборки.
 */
export function Hud(props: Props): JSX.Element {
  const model = useFactoryModel();
  const locale = useLocale();
  const recording = useStoreValue(model.$recording);
  const summary = useStoreValue(model.$summary);
  const stats = () => [
    { label: UI_TEXT.hud.time[locale], value: formatDuration(summary().durationMs, locale) },
    { label: UI_TEXT.hud.tokens[locale], value: formatTokens(summary().tokens, locale) },
    { label: UI_TEXT.hud.prompts[locale], value: String(summary().prompts) },
    { label: UI_TEXT.hud.reworks[locale], value: String(summary().reworks) },
    { label: UI_TEXT.hud.interventions[locale], value: String(summary().interventions) },
  ];
  // В серии номер сборки считают с единицы, как задачи проекта.
  const positionLabel = (position: SeriesPosition) => {
    const buildNumber = position.index + 1;

    return UI_TEXT.series.buildOf[locale](buildNumber, position.count);
  };
  // Подписи после проекта: место сборки в серии, день и язык записи. В серии они меняются вместе
  // со сборкой, поэтому строятся заново из пропсов и записи модели.
  const captionParts = () => {
    const position = props.position === undefined ? undefined : positionLabel(props.position);
    const date = formatDate(recording().timestamp, locale);

    return [position, date, props.languageNote].filter((part) => part !== undefined);
  };

  return (
    <Panel label={UI_TEXT.hud.label[locale]} class={styles.hud}>
      <header class={styles.header}>
        <Title as={props.titleLevel} size="xl" lang={recording().data.language}>
          {recording().data.title}
        </Title>
        <p class={styles.date}>
          <span class={styles.part}>
            <Show when={props.project.url} fallback={props.project.name}>
              {(url) => (
                <ButtonLink variant="link" href={url()}>
                  {props.project.name}
                </ButtonLink>
              )}
            </Show>
          </span>
          <For each={captionParts()}>
            {(part) => (
              <>
                {" "}
                <span class={styles.part}>· {part}</span>
              </>
            )}
          </For>
        </p>
      </header>
      <div class={styles.stats}>
        <StatList items={stats()} />
      </div>
      <div class={styles.speech}>
        <SpeechDock title={recording().data.title} />
      </div>
      <PlaybackControls />
    </Panel>
  );
}
