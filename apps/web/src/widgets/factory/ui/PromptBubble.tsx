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
  /** Графика цеха — переводит место рабочего в координаты пола; нет, пока не загрузилась. */
  graphics: FactoryGraphics | undefined;
  /** Поле цеха, свободное от меню и HUD: пузырь раскрывается к его середине. */
  field: Frame;
}

/**
 * Промпт над рабочим, который его получил: кому, главное указание и раскрываемые уточнения.
 * @param {Props} props Свойства компонента.
 * @param {FactoryGraphics | undefined} props.graphics Графика цеха, если уже загружена.
 * @param {Frame} props.field Поле цеха, свободное от меню и HUD.
 * @returns {JSX.Element} Пузырь промпта или ничего, если промпта нет.
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
        <SpeechBubble graphics={props.graphics} field={props.field} position={position()}>
          <Chip tone="sky">
            {UI_TEXT.speech.humanTo[locale](recipientOf(current().prompt, locale))}
          </Chip>
          <Title>{current().prompt.goal}</Title>
          <Show when={current().prompt.requirements.length > 0}>
            <Button
              variant="link"
              aria-expanded={detailsOpen()}
              onClick={() => model.togglePromptDetails()}
            >
              {detailsOpen() ? UI_TEXT.speech.less[locale] : UI_TEXT.speech.more[locale]}
            </Button>
            <Show when={detailsOpen()}>
              <BulletList items={current().prompt.requirements} />
            </Show>
          </Show>
        </SpeechBubble>
      )}
    </Show>
  );
}
