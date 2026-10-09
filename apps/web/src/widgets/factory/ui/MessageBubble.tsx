import { Show, type JSX } from "solid-js";
import { routeOf } from "@/entities/message";
import { useLocale } from "@/shared/i18n/locale-context.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { Button, Chip, Title } from "@/shared/ui";
import type { FactoryGraphics, Frame } from "../graphics/factory-graphics.ts";
import { useFactoryModel } from "./model-context.ts";
import { showMessageDetails } from "./open-journal.ts";
import { SpeechBubble } from "./SpeechBubble.tsx";

interface Props {
  /** Factory graphics: converts the speaker's spot to floor coordinates; absent until loaded. */
  graphics: FactoryGraphics | undefined;
  /** Floor field free of the menu and HUD: the bubble does not go past its edges. */
  field: Frame;
}

/**
 * A message above the speaker, the foreman or a worker: who to whom, one line, and "more", which
 * pauses the floor and opens the journal at the full text.
 * @param {Props} props Component props.
 * @param {FactoryGraphics | undefined} props.graphics Factory graphics, if already loaded.
 * @param {Frame} props.field Floor field free of the menu and HUD.
 * @returns {JSX.Element} The message bubble, or nothing if nobody is speaking now.
 */
export function MessageBubble(props: Props): JSX.Element {
  const model = useFactoryModel();
  const locale = useLocale();
  const cue = useStoreValue(model.$message);
  const position = useStoreValue(model.$messagePosition);

  return (
    <Show when={cue()}>
      {(current) => (
        <SpeechBubble
          graphics={props.graphics}
          field={props.field}
          position={position()}
          actions={
            <Button variant="link" onClick={() => showMessageDetails(model, current().index)}>
              {UI_TEXT.speech.more[locale]}
            </Button>
          }
        >
          <Chip tone="sky">{routeOf(current().message, locale)}</Chip>
          <Title>{current().message.line}</Title>
        </SpeechBubble>
      )}
    </Show>
  );
}
