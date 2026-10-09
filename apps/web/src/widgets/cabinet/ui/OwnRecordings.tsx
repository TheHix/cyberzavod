import { createSignal, For, Show, type JSX } from "solid-js";
import { sharedRecordingUrl, type RecordingSummary } from "@/entities/gallery";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatDate } from "@/shared/lib/format.ts";
import { languageNoteOf } from "@/shared/lib/language-note.ts";
import { Button, Card, Chip, Title } from "@/shared/ui";
import styles from "./CabinetBoard.module.css";

interface RecordingCardProps {
  recording: RecordingSummary;
  /** An action is running in the cabinet: buttons are disabled. */
  isBusy: boolean;
  locale: Locale;
  onDelete: (id: string) => void;
}

interface Props {
  recordings: readonly RecordingSummary[];
  /** How many recordings fit in the gallery. */
  limit: number;
  isBusy: boolean;
  locale: Locale;
  onDelete: (id: string) => void;
}

// "Delete" asks first: a deleted recording cannot be restored, and its link will stop working.
function DeleteControl(props: RecordingCardProps): JSX.Element {
  const [isConfirming, setConfirming] = createSignal(false);

  return (
    <Show
      when={isConfirming()}
      fallback={
        <Button
          disabled={props.isBusy}
          aria-label={UI_TEXT.cabinet.deleteLabel[props.locale](props.recording.title)}
          onClick={() => setConfirming(true)}
        >
          {UI_TEXT.cabinet.delete[props.locale]}
        </Button>
      }
    >
      <p class={styles.note}>{UI_TEXT.cabinet.deleteQuestion[props.locale]}</p>
      <div class={styles.actions}>
        <Button
          variant="primary"
          disabled={props.isBusy}
          aria-label={UI_TEXT.cabinet.deleteLabel[props.locale](props.recording.title)}
          onClick={() => props.onDelete(props.recording.id)}
        >
          {UI_TEXT.cabinet.delete[props.locale]}
        </Button>
        <Button disabled={props.isBusy} onClick={() => setConfirming(false)}>
          {UI_TEXT.cabinet.cancel[props.locale]}
        </Button>
      </div>
    </Show>
  );
}

function RecordingCard(props: RecordingCardProps): JSX.Element {
  return (
    <Card>
      <div class={styles.card}>
        <Chip tone="sun">{formatDate(props.recording.startedAt, props.locale)}</Chip>
        <a href={sharedRecordingUrl(props.recording.slug, props.locale)}>
          <Title as="span" lang={props.recording.language}>
            {props.recording.title}
          </Title>
        </a>
        <p class={styles.note}>
          {props.recording.projectId}
          <Show when={languageNoteOf(props.recording.language, props.locale)}>
            {(note) => ` · ${note()}`}
          </Show>
        </p>
        <DeleteControl {...props} />
      </div>
    </Card>
  );
}

/**
 * Recordings of the own gallery: how much of the limit is used, and cards with a link to the floor
 * and deletion.
 * @param {Props} props Component props.
 * @param {readonly RecordingSummary[]} props.recordings Recordings, newest on top.
 * @param {number} props.limit How many recordings fit in the gallery.
 * @param {boolean} props.isBusy Whether an action is running in the cabinet.
 * @param {Locale} props.locale Page language.
 * @param {(id: string) => void} props.onDelete Deletes a recording by id.
 * @returns {JSX.Element} Section with recordings.
 */
export function OwnRecordings(props: Props): JSX.Element {
  return (
    <section class={styles.section}>
      <div class={styles.heading}>
        <Title as="h2">{UI_TEXT.cabinet.recordingsHeading[props.locale]}</Title>
        <Chip>{UI_TEXT.cabinet.usage[props.locale](props.recordings.length, props.limit)}</Chip>
      </div>
      <Show
        when={props.recordings.length > 0}
        fallback={<p class={styles.note}>{UI_TEXT.cabinet.noRecordings[props.locale]}</p>}
      >
        <ul class={styles.list}>
          <For each={props.recordings}>
            {(recording) => (
              <li>
                <RecordingCard
                  recording={recording}
                  isBusy={props.isBusy}
                  locale={props.locale}
                  onDelete={props.onDelete}
                />
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
