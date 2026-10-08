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
  /** id записи, к которой относится речь: цех мог уже перейти к другой записи серии. */
  recordingId: string;
  speech: Speech;
  /** Язык страницы: на нём кнопка «показать в цехе». */
  locale: Locale;
  clock: string;
  route: string;
  children: JSX.Element;
}

/**
 * Запись журнала сборки: время, маршрут и тело записи. В браузере подсвечивается, когда цех
 * проигрывает эту запись и дошёл до этой речи, и получает кнопку «показать в цехе»: она
 * перематывает цех и закрывает журнал, чтобы сцена была видна. Без JS — та же разметка без них.
 * @param {Props} props Свойства компонента.
 * @param {string} props.recordingId id записи, к которой относится речь.
 * @param {Speech} props.speech Какой промпт, вмешательство или реплика записи.
 * @param {Locale} props.locale Язык страницы.
 * @param {string} props.clock Время записи в сборке, например `01:30`.
 * @param {string} props.route Маршрут: от кого и кому или метка вмешательства.
 * @param {JSX.Element} props.children Статичное тело записи из `.astro`.
 * @returns {JSX.Element} Запись журнала.
 */
export function JournalEntry(props: Props): JSX.Element {
  const sceneRecordingId = useStoreValue($sceneRecordingId);
  const sceneSpeech = useStoreValue($sceneSpeech);
  const isSceneHere = () =>
    sceneRecordingId() === props.recordingId && isSameSpeech(sceneSpeech(), props.speech);

  // Подсветка и кнопка только после монтирования: разметка с сервера совпадает с первым
  // рендером в браузере, а без JS их нет вовсе.
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
