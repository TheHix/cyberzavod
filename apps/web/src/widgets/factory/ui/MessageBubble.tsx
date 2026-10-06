import { Show, type JSX } from "solid-js";
import { routeOf } from "@/entities/message";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { Button, Chip, Title } from "@/shared/ui";
import type { FactoryGraphics, Frame } from "../graphics/factory-graphics.ts";
import { useFactoryModel } from "./model-context.ts";
import { showMessageDetails } from "./open-journal.ts";
import { SpeechBubble } from "./SpeechBubble.tsx";

interface Props {
  /** Графика цеха — переводит место говорящего в координаты пола; нет, пока не загрузилась. */
  graphics: FactoryGraphics | undefined;
  /** Поле цеха, свободное от меню и HUD: пузырь раскрывается к его середине. */
  field: Frame;
}

/**
 * Реплика над говорящим — мастером или рабочим: кто кому, одна строка и «подробнее», которое
 * ставит цех на паузу и открывает журнал на полном тексте.
 * @param {Props} props Свойства компонента.
 * @param {FactoryGraphics | undefined} props.graphics Графика цеха, если уже загружена.
 * @param {Frame} props.field Поле цеха, свободное от меню и HUD.
 * @returns {JSX.Element} Пузырь реплики или ничего, если сейчас никто не говорит.
 */
export function MessageBubble(props: Props): JSX.Element {
  const model = useFactoryModel();
  const cue = useStoreValue(model.$message);
  const position = useStoreValue(model.$messagePosition);

  return (
    <Show when={cue()}>
      {(current) => (
        <SpeechBubble graphics={props.graphics} field={props.field} position={position()}>
          <Chip tone="sky">{routeOf(current().message)}</Chip>
          <Title>{current().message.line}</Title>
          <Button variant="link" onClick={() => showMessageDetails(model, current().index)}>
            подробнее
          </Button>
        </SpeechBubble>
      )}
    </Show>
  );
}
