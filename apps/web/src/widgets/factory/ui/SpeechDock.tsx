import { Match, Show, Switch, type JSX } from "solid-js";
import { labelOf } from "@/entities/intervention";
import { routeOf } from "@/entities/message";
import { recipientOf } from "@/entities/prompt";
import { useLocale } from "@/shared/i18n/locale-context.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { BulletList, Button, Chip, Title } from "@/shared/ui";
import { useFactoryModel } from "./model-context.ts";
import { showInterventionDetails, showMessageDetails } from "./open-journal.ts";
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
 * @returns {JSX.Element} Полка с вмешательством, промптом, репликой или названием сборки.
 */
export function SpeechDock(props: Props): JSX.Element {
  const model = useFactoryModel();
  const locale = useLocale();
  const prompt = useStoreValue(model.$prompt);
  const intervention = useStoreValue(model.$intervention);
  const message = useStoreValue(model.$message);
  const detailsOpen = useStoreValue(model.$promptDetailsOpen);

  return (
    <div class={styles.dock}>
      <Switch>
        <Match when={message()}>
          {(current) => (
            <>
              <div class={styles.route}>
                <Chip tone="sky">{routeOf(current().message, locale)}</Chip>
                <Button variant="link" onClick={() => showMessageDetails(model, current().index)}>
                  {UI_TEXT.speech.more[locale]}
                </Button>
              </div>
              <Title size="m" lines={LINE_COUNT}>
                {current().message.line}
              </Title>
            </>
          )}
        </Match>
        <Match when={intervention()}>
          {(current) => (
            <>
              <div class={styles.route}>
                <Chip tone="sun">{labelOf(current().intervention, locale)}</Chip>
                <Button
                  variant="link"
                  onClick={() => showInterventionDetails(model, current().index)}
                >
                  {UI_TEXT.speech.more[locale]}
                </Button>
              </div>
              <Title size="m" lines={LINE_COUNT}>
                {current().intervention.line}
              </Title>
            </>
          )}
        </Match>
        <Match when={prompt()}>
          {(current) => (
            <>
              <div class={styles.route}>
                <Chip tone="sky">
                  {UI_TEXT.speech.humanTo[locale](recipientOf(current().prompt, locale))}
                </Chip>
                <Show when={current().prompt.requirements.length > 0}>
                  <Button
                    variant="link"
                    aria-expanded={detailsOpen()}
                    onClick={() => model.togglePromptDetails()}
                  >
                    {detailsOpen() ? UI_TEXT.speech.less[locale] : UI_TEXT.speech.more[locale]}
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
