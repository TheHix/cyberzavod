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
  /** Графика цеха — переводит место мастера в координаты пола; нет, пока не загрузилась. */
  graphics: FactoryGraphics | undefined;
  /** Поле цеха, свободное от меню и HUD: пузырь раскрывается к его середине. */
  field: Frame;
}

/**
 * Вмешательство человека над мастером, который вышел к станции с решением: кто и почему
 * вмешался, одна строка и «подробнее», которое ставит цех на паузу и открывает журнал на
 * полном тексте.
 * @param {Props} props Свойства компонента.
 * @param {FactoryGraphics | undefined} props.graphics Графика цеха, если уже загружена.
 * @param {Frame} props.field Поле цеха, свободное от меню и HUD.
 * @returns {JSX.Element} Пузырь вмешательства или ничего, если сейчас его никто не говорит.
 */
export function InterventionBubble(props: Props): JSX.Element {
  const model = useFactoryModel();
  const locale = useLocale();
  const cue = useStoreValue(model.$intervention);
  const position = useStoreValue(model.$interventionPosition);

  return (
    <Show when={cue()}>
      {(current) => (
        <SpeechBubble graphics={props.graphics} field={props.field} position={position()}>
          <Chip tone="sun">{labelOf(current().intervention, locale)}</Chip>
          <Title>{current().intervention.line}</Title>
          <Button variant="link" onClick={() => showInterventionDetails(model, current().index)}>
            {UI_TEXT.speech.more[locale]}
          </Button>
        </SpeechBubble>
      )}
    </Show>
  );
}
