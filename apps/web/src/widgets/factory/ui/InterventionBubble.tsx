import { Show, type JSX } from "solid-js";
import { labelOf } from "@/entities/intervention";
import { useLocale } from "@/shared/i18n/locale-context.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { Button, Chip, Title } from "@/shared/ui";
import type { FactoryGraphics, Frame } from "../graphics/factory-graphics.ts";
import { useFactoryModel } from "./model-context.ts";
import { showInterventionDetails } from "./open-journal.ts";
import { SpeechBubble } from "./SpeechBubble.tsx";

interface Props {
  /** Factory graphics: converts the foreman's spot to floor coordinates; absent until loaded. */
  graphics: FactoryGraphics | undefined;
  /** Floor field free of the menu and HUD: the bubble does not go past its edges. */
  field: Frame;
}

/**
 * A human intervention above the foreman who came to the station with a decision: who intervened
 * and why, one line, and "more", which pauses the floor and opens the journal at the full text.
 * @param {Props} props Component props.
 * @param {FactoryGraphics | undefined} props.graphics Factory graphics, if already loaded.
 * @param {Frame} props.field Floor field free of the menu and HUD.
 * @returns {JSX.Element} The intervention bubble, or nothing if nobody is saying one now.
 */
export function InterventionBubble(props: Props): JSX.Element {
  const model = useFactoryModel();
  const locale = useLocale();
  const cue = useStoreValue(model.$intervention);
  const position = useStoreValue(model.$interventionPosition);

  return (
    <Show when={cue()}>
      {(current) => (
        <SpeechBubble
          graphics={props.graphics}
          field={props.field}
          position={position()}
          actions={
            <Button variant="link" onClick={() => showInterventionDetails(model, current().index)}>
              {UI_TEXT.speech.more[locale]}
            </Button>
          }
        >
          <Chip tone="sun">{labelOf(current().intervention, locale)}</Chip>
          <Title>{current().intervention.line}</Title>
        </SpeechBubble>
      )}
    </Show>
  );
}
