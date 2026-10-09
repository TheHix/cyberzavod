import { Show, type JSX } from "solid-js";
import { recipientOf } from "@/entities/prompt";
import { useLocale } from "@/shared/i18n/locale-context.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { BulletList, Button, Chip, Title } from "@/shared/ui";
import type { FactoryGraphics, Frame } from "../graphics/factory-graphics.ts";
import { useFactoryModel } from "./model-context.ts";
import { SpeechBubble } from "./SpeechBubble.tsx";

interface Props {
  /** Factory graphics: converts the worker's spot to floor coordinates; absent until loaded. */
  graphics: FactoryGraphics | undefined;
  /** Floor field free of the menu and HUD: the bubble does not go past its edges. */
  field: Frame;
}

/**
 * A prompt above the worker who received it: to whom, the main instruction and expandable details.
 * Long details scroll inside the bubble together with the instruction, while "collapse" stays
 * below them.
 * @param {Props} props Component props.
 * @param {FactoryGraphics | undefined} props.graphics Factory graphics, if already loaded.
 * @param {Frame} props.field Floor field free of the menu and HUD.
 * @returns {JSX.Element} The prompt bubble, or nothing if there is no prompt.
 */
export function PromptBubble(props: Props): JSX.Element {
  const model = useFactoryModel();
  const locale = useLocale();
  const cue = useStoreValue(model.$prompt);
  const position = useStoreValue(model.$promptPosition);
  const detailsOpen = useStoreValue(model.$promptDetailsOpen);

  return (
    <Show when={cue()}>
      {(current) => (
        <SpeechBubble
          graphics={props.graphics}
          field={props.field}
          position={position()}
          actions={
            <Show when={current().prompt.requirements.length > 0}>
              <Button
                variant="link"
                aria-expanded={detailsOpen()}
                onClick={() => model.togglePromptDetails()}
              >
                {detailsOpen() ? UI_TEXT.speech.less[locale] : UI_TEXT.speech.more[locale]}
              </Button>
            </Show>
          }
        >
          <Chip tone="sky">
            {UI_TEXT.speech.humanTo[locale](recipientOf(current().prompt, locale))}
          </Chip>
          <Title>{current().prompt.goal}</Title>
          <Show when={detailsOpen()}>
            <BulletList items={current().prompt.requirements} />
          </Show>
        </SpeechBubble>
      )}
    </Show>
  );
}
