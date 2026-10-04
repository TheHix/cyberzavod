import type { JSX } from "solid-js";
import { formatClock } from "@/shared/lib/format.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { useFactoryModel } from "./model-context.ts";
import styles from "./PlaybackControls.module.css";

// Шкала перематывается шагами по 0,1 с сцены — точнее глаз не различит.
const SCRUB_STEP_MS = 100;

/**
 * Управление проигрыванием цеха: пуск и пауза, шкала, время записи и скорость.
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
      <button
        type="button"
        class={styles.button}
        disabled={disabled()}
        aria-label={playback().playing ? "Пауза" : "Смотреть"}
        onClick={() => model.toggle()}
      >
        {playback().playing ? "❚❚" : "▶"}
      </button>
      <input
        class={styles.scrubber}
        type="range"
        min="0"
        max={Math.round(playback().duration)}
        step={SCRUB_STEP_MS}
        value={Math.round(playback().position)}
        disabled={disabled()}
        aria-label="Момент сборки"
        onInput={(event) => model.seek(Number(event.currentTarget.value))}
      />
      <span class={styles.clock} title="Время от начала сборки">
        {formatClock(recordingTime())}
      </span>
      <button
        type="button"
        class={styles.button}
        disabled={disabled()}
        aria-label="Скорость проигрывания"
        onClick={() => model.cycleSpeed()}
      >
        ×{playback().speed}
      </button>
    </div>
  );
}
