import { Match, Show, Switch, type JSX } from "solid-js";
import { routeOf } from "@/entities/message";
import { recipientOf } from "@/entities/prompt";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { BulletList, Button, Chip, Title } from "@/shared/ui";
import { useFactoryModel } from "./model-context.ts";
import { showMessageDetails } from "./open-journal.ts";
import styles from "./SpeechDock.module.css";

/** Сколько строк текста держит полка: больше обрезается, полный текст — в журнале. */
const LINE_COUNT = 2;

interface Props {
  /** Название сборки: его показывает полка, пока никто не говорит. */
  title: string;
}

/**
 * Полка речи в HUD: то, что на широком экране висит пузырём над говорящим, на узком стоит над
 * управлением, а на низком рядом с ним, чтобы не закрывать станки. Высота постоянная: поле цеха не
 * прыгает от смены реплик.
 * @param {Props} props Свойства компонента.
 * @param {string} props.title Название сборки для паузы между репликами.
 * @returns {JSX.Element} Полка с промптом, репликой или названием сборки.
 */
export function SpeechDock(props: Props): JSX.Element {
  const model = useFactoryModel();
  const prompt = useStoreValue(model.$prompt);
  const message = useStoreValue(model.$message);
  const detailsOpen = useStoreValue(model.$promptDetailsOpen);

  return (
    <div class={styles.dock}>
      <Switch>
        <Match when={message()}>
          {(current) => (
            <>
              <div class={styles.route}>
                <Chip tone="sky">{routeOf(current().message)}</Chip>
                <Button variant="link" onClick={() => showMessageDetails(model, current().index)}>
                  подробнее
                </Button>
              </div>
              <Title size="m" lines={LINE_COUNT}>
                {current().message.line}
              </Title>
            </>
          )}
        </Match>
        <Match when={prompt()}>
          {(current) => (
            <>
              <div class={styles.route}>
                <Chip tone="sky">человек → {recipientOf(current().prompt)}</Chip>
                <Show when={current().prompt.requirements.length > 0}>
                  <Button
                    variant="link"
                    aria-expanded={detailsOpen()}
                    onClick={() => model.togglePromptDetails()}
                  >
                    {detailsOpen() ? "свернуть" : "подробнее"}
                  </Button>
                </Show>
              </div>
              <Title size="m" lines={LINE_COUNT}>
                {current().prompt.goal}
              </Title>
              <Show when={detailsOpen()}>
                <BulletList items={current().prompt.requirements} />
              </Show>
            </>
          )}
        </Match>
        <Match when={true}>
          <div class={styles.route} aria-hidden="true" />
          <div aria-hidden="true">
            <Title size="m" lines={LINE_COUNT}>
              {props.title}
            </Title>
          </div>
        </Match>
      </Switch>
    </div>
  );
}
