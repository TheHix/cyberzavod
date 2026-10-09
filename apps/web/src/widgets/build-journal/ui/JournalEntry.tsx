import { createSignal, onMount, Show, type JSX } from "solid-js";
import {
  $sceneRecordingId,
  $sceneSpeech,
  isSameSpeech,
  seekScene,
  type Speech,
} from "@/features/journal-sync";
import { PANELS } from "@/shared/config/panels.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { Button, Card, Chip } from "@/shared/ui";
import styles from "./JournalEntry.module.css";

interface Props {
  /**
   * Id of the recording the speech belongs to: the floor may have moved to another series
   * recording.
   */
  recordingId: string;
  speech: Speech;
  /** Page language: the "show on floor" button is in it. */
  locale: Locale;
  clock: string;
  route: string;
  children: JSX.Element;
}

/**
 * Build journal entry: time, route and entry body. In the browser it is highlighted when the floor
 * plays this recording and has reached this speech, and gets a "show on floor" button: it
 * rewinds the floor and closes the journal so the scene is visible. Without JS, the same markup
 * without them.
 * @param {Props} props Component props.
 * @param {string} props.recordingId Id of the recording the speech belongs to.
 * @param {Speech} props.speech Which prompt, intervention or message of the recording.
 * @param {Locale} props.locale Page language.
 * @param {string} props.clock Entry time in the build, e.g. `01:30`.
 * @param {string} props.route Route: from whom to whom, or the intervention label.
 * @param {JSX.Element} props.children Static entry body from `.astro`.
 * @returns {JSX.Element} Journal entry.
 */
export function JournalEntry(props: Props): JSX.Element {
  const sceneRecordingId = useStoreValue($sceneRecordingId);
  const sceneSpeech = useStoreValue($sceneSpeech);
  const isSceneHere = () =>
    sceneRecordingId() === props.recordingId && isSameSpeech(sceneSpeech(), props.speech);

  // Highlighting and the button only after mounting: the server markup matches the first render in
  // the browser, and without JS they do not exist at all.
  const [hydrated, setHydrated] = createSignal(false);

  onMount(() => setHydrated(true));
  const current = () => hydrated() && isSceneHere();

  return (
    <Card current={current()}>
      <p class={styles.route}>
        <Chip>{props.clock}</Chip>
        <Chip tone="sky">{props.route}</Chip>
        <Show when={hydrated()}>
          <Button
            variant="link"
            class={styles.seek}
            popovertarget={PANELS.journal}
            popovertargetaction="hide"
            aria-label={UI_TEXT.journal.showOnFloorLabel[props.locale](props.clock, props.route)}
            onClick={() => seekScene(props.recordingId, props.speech)}
          >
            {UI_TEXT.journal.showOnFloor[props.locale]}
          </Button>
        </Show>
      </p>
      {props.children}
    </Card>
  );
}
