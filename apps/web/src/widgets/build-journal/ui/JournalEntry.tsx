import { createSignal, onMount, Show, type JSX } from "solid-js";
import { $sceneSpeech, isSameSpeech, seekScene, type Speech } from "@/features/journal-sync";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { Button, Card, Chip } from "@/shared/ui";
import styles from "./JournalEntry.module.css";

interface Props {
  speech: Speech;
  clock: string;
  route: string;
  children: JSX.Element;
}

/**
 * Запись журнала сборки: время, маршрут и тело записи. В браузере подсвечивается, когда цех
 * дошёл до этой речи, и получает кнопку «показать в цехе». Без JS — та же разметка без них.
 * @param {Props} props Свойства компонента.
 * @param {Speech} props.speech Какой промпт или реплика записи.
 * @param {string} props.clock Время записи в сборке, например `01:30`.
 * @param {string} props.route Маршрут: от кого и кому.
 * @param {JSX.Element} props.children Статичное тело записи из `.astro`.
 * @returns {JSX.Element} Запись журнала.
 */
export function JournalEntry(props: Props): JSX.Element {
  const sceneSpeech = useStoreValue($sceneSpeech);
  // Подсветка и кнопка только после монтирования: разметка с сервера совпадает с первым
  // рендером в браузере, а без JS их нет вовсе.
  const [hydrated, setHydrated] = createSignal(false);
  onMount(() => setHydrated(true));
  const current = () => hydrated() && isSameSpeech(sceneSpeech(), props.speech);

  return (
    <Card current={current()}>
      <p class={styles.route}>
        <Chip>{props.clock}</Chip>
        <Chip tone="sky">{props.route}</Chip>
        <Show when={hydrated()}>
          <Button variant="link" class={styles.seek} onClick={() => seekScene(props.speech)}>
            показать в цехе
          </Button>
        </Show>
      </p>
      {props.children}
    </Card>
  );
}
