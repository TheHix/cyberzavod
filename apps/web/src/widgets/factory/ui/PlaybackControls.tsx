import Pause from "lucide-solid/icons/pause";
import Play from "lucide-solid/icons/play";
import { Show, type JSX } from "solid-js";
import { formatClock } from "@/shared/lib/format.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { Button, SegmentedControl, Slider, type SegmentOption } from "@/shared/ui";
import { SPEEDS, speedFrom, type Speed } from "../model/playback.ts";
import { useFactoryModel } from "./model-context.ts";
import styles from "./PlaybackControls.module.css";

// Шкала перематывается шагами по 0,1 с сцены — точнее глаз не различит.
const SCRUB_STEP_MS = 100;
const ICON_SIZE = 30;
const SPEED_OPTIONS: readonly SegmentOption<`${Speed}`>[] = SPEEDS.map((speed) => ({
  value: `${speed}`,
  label: `×${speed}`,
}));

/**
 * Управление проигрыванием цеха: пуск и пауза, шкала со временем записи, скорость.
 * @returns {JSX.Element} Панель управления.
 */
export function PlaybackControls(): JSX.Element {
  const model = useFactoryModel();
  const status = useStoreValue(model.$status);
  const playback = useStoreValue(model.$playback);
  const recordingTime = useStoreValue(model.$recordingTime);
  const disabled = () => status() !== "ready";

  return (
    <div class={styles.controls}>
      <Button
        variant="primary"
        size="large"
        layout="round"
        disabled={disabled()}
        aria-label={playback().playing ? "Пауза" : "Смотреть"}
        onClick={() => model.toggle()}
      >
        <Show when={playback().playing} fallback={<Play size={ICON_SIZE} fill="currentColor" />}>
          <Pause size={ICON_SIZE} fill="currentColor" />
        </Show>
      </Button>
      <div class={styles.timeline}>
        <Slider
          label="Момент сборки"
          value={playback().position}
          max={playback().duration}
          step={SCRUB_STEP_MS}
          disabled={disabled()}
          valueText={() => formatClock(recordingTime())}
          onChange={(position) => model.seek(position)}
        />
        <div class={styles.times}>
          <span title="Время от начала сборки">{formatClock(recordingTime())}</span>
          <span title="Длина сборки">{formatClock(model.summary.durationMs)}</span>
        </div>
      </div>
      <div class={styles.speed}>
        <span>Скорость</span>
        <SegmentedControl
          label="Скорость проигрывания"
          options={SPEED_OPTIONS}
          value={`${playback().speed}`}
          disabled={disabled()}
          onChange={(value) => {
            const speed = speedFrom(value);
            if (speed !== undefined) model.setSpeed(speed);
          }}
        />
      </div>
    </div>
  );
}
