import { Match, Show, Switch, type JSX } from "solid-js";
import { labelOf } from "@/entities/intervention";
import { routeOf } from "@/entities/message";
import { recipientOf } from "@/entities/prompt";
import { useLocale } from "@/shared/i18n/locale-context.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { BulletList, Button, Chip, ScrollArea, Title } from "@/shared/ui";
import { useFactoryModel } from "./model-context.ts";
import { showInterventionDetails, showMessageDetails } from "./open-journal.ts";
import styles from "./SpeechDock.module.css";

/** How many lines of text the shelf holds: the rest is in the journal or under "more". */
const LINE_COUNT = 2;

interface Props {
  /** Build name: the shelf shows it while nobody is speaking. */
  title: string;
}

/**
 * The speech shelf in the HUD: what hangs as a bubble above the speaker on a wide screen stands
 * above the controls on a narrow one, and next to them on a short one, so as not to cover the
 * machines. The height is constant: the floor field does not jump when messages change. "More" on
 * a prompt shows the whole instruction and the details: they scroll together within a limited
 * height, and the shelf does not take the whole field from the factory.
 * @param {Props} props Component props.
 * @param {string} props.title Build name for the pause between messages.
 * @returns {JSX.Element} The shelf with an intervention, prompt, message or the build name.
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
              <Show
                when={detailsOpen()}
                fallback={
                  <Title size="m" lines={LINE_COUNT}>
                    {current().prompt.goal}
                  </Title>
                }
              >
                <ScrollArea class={styles.details}>
                  <Title size="m">{current().prompt.goal}</Title>
                  <BulletList items={current().prompt.requirements} />
                </ScrollArea>
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
