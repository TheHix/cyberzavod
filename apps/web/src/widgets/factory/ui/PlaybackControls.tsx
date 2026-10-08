import Pause from "lucide-solid/icons/pause";
import Play from "lucide-solid/icons/play";
import { Show, type JSX } from "solid-js";
import { useLocale } from "@/shared/i18n/locale-context.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
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
  const locale = useLocale();
  const status = useStoreValue(model.$status);
  const playback = useStoreValue(model.$playback);
  const recordingTime = useStoreValue(model.$recordingTime);
  const summary = useStoreValue(model.$summary);
  const isReady = () => status() === "ready";

  return (
    <div class={styles.controls}>
      <Button
        variant="primary"
        size="large"
        layout="round"
        disabled={!isReady()}
        aria-label={
          playback().playing ? UI_TEXT.playback.pause[locale] : UI_TEXT.playback.play[locale]
        }
        onClick={() => model.toggle()}
      >
        <Show when={playback().playing} fallback={<Play size={ICON_SIZE} fill="currentColor" />}>
          <Pause size={ICON_SIZE} fill="currentColor" />
        </Show>
      </Button>
      <div class={styles.timeline}>
        <Slider
          label={UI_TEXT.playback.scrubber[locale]}
          value={playback().position}
          max={playback().duration}
          step={SCRUB_STEP_MS}
          disabled={!isReady()}
          valueText={() => formatClock(recordingTime())}
          onChange={(position) => model.seek(position)}
        />
        <div class={styles.times}>
          <span title={UI_TEXT.playback.elapsed[locale]}>{formatClock(recordingTime())}</span>
          <span title={UI_TEXT.playback.length[locale]}>{formatClock(summary().durationMs)}</span>
        </div>
      </div>
      <div class={styles.speed}>
        <span>{UI_TEXT.playback.speed[locale]}</span>
        <SegmentedControl
          label={UI_TEXT.playback.speedLabel[locale]}
          options={SPEED_OPTIONS}
          value={`${playback().speed}`}
          disabled={!isReady()}
          onChange={(value) => {
            const speed = speedFrom(value);

            if (speed !== undefined) model.setSpeed(speed);
          }}
        />
      </div>
    </div>
  );
}
