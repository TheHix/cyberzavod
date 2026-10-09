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
  /** The project that was built: it stands next to the date. */
  project: BuildProject;
  /**
   * Note about the recording's original language next to the date; absent if the recording is in
   * the page language.
   */
  languageNote: string | undefined;
  /**
   * Place of the build in its project's series next to the project; absent for a single recording.
   */
  position: SeriesPosition | undefined;
  /** Heading level: on the recording page it is the main heading, on the home page it is not. */
  titleLevel: "h1" | "h2";
}

/**
 * Factory HUD: which build is running, which project it belongs to, its totals and playback
 * controls. Takes the recording and totals from the factory model: in a series they change with
 * the build. On a wide screen it is on the right, on a narrow and short one under the field, and
 * there it has the speech shelf instead of bubbles above the machines.
 * @param {Props} props Component props.
 * @param {BuildProject} props.project The project that was built.
 * @param {string | undefined} props.languageNote Note about the recording's original language.
 * @param {SeriesPosition | undefined} props.position Place of the build in its project's series.
 * @param {"h1" | "h2"} props.titleLevel Level of the heading with the build name.
 * @returns {JSX.Element} Build panel.
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
  // In a series the build number counts from one, like the project's tasks.
  const positionLabel = (position: SeriesPosition) => {
    const buildNumber = position.index + 1;

    return UI_TEXT.series.buildOf[locale](buildNumber, position.count);
  };
  // Captions after the project: the build's place in the series, the day and the recording
  // language. In a series they change with the build, so they are rebuilt from the props and the
  // model's recording.
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
