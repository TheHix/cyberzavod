import { createMemo, createSignal, For, onCleanup, onMount, Show, type JSX } from "solid-js";
import { buildScript, type PromptCue, type Recording, type Scene } from "@cyberzavod/core";
import { recipientOf } from "@/entities/prompt";
import { formatClock } from "@/shared/lib/format.ts";
import type { Playback, Speed } from "../model/playback.ts";
import { loadFactoryView, type FactoryView, type ScreenPoint } from "../view/factory-view.ts";
import { FactoryPlayer } from "./player.ts";
import styles from "./Factory.module.css";

interface Props {
  recording: Recording;
}

type Status = "loading" | "ready" | "failed";

// Шкала перематывается шагами по 0,1 с сцены — точнее глаз не различит.
const SCRUB_STEP_MS = 100;
// У края пола — крайняя треть ширины — пузырь прижимается к краю, а не центрируется.
const EDGE_ZONE = 1 / 3;

// Пузырь промпта открывается в сторону середины пола, чтобы не уйти за край цеха.
function placeBubble(anchor: HTMLElement, point: ScreenPoint, floor: HTMLElement): void {
  const width = floor.clientWidth;
  anchor.style.transform = `translate(${point.x}px, ${point.y}px)`;
  anchor.dataset.vertical = point.y < floor.clientHeight / 2 ? "below" : "above";
  anchor.dataset.horizontal =
    point.x < width * EDGE_ZONE ? "start" : point.x > width * (1 - EDGE_ZONE) ? "end" : "center";
}

/**
 * Живой цех: проигрывает запись сборки — рабочие у станков, бег с деталью, промпты над
 * рабочими. Графика грузится только в браузере, когда цех на экране.
 * @param {Props} props Свойства компонента.
 * @param {Recording} props.recording Запись сборки, которую проигрывает цех.
 * @returns {JSX.Element} Цех с управлением проигрыванием.
 */
export function Factory(props: Props): JSX.Element {
  const script = createMemo(() => buildScript(props.recording));
  const [status, setStatus] = createSignal<Status>("loading");
  const [playing, setPlaying] = createSignal(false);
  const [speed, setSpeed] = createSignal<Speed>(1);
  const [cue, setCue] = createSignal<PromptCue | null>(null);
  const [expanded, setExpanded] = createSignal(false);
  // Ссылки на элементы задаются в разметке через ref и живут столько же, сколько компонент.
  let floor!: HTMLDivElement;
  let canvasHost!: HTMLDivElement;
  let scrubber!: HTMLInputElement;
  let clock!: HTMLSpanElement;
  let bubbleAnchor: HTMLDivElement | undefined;
  let view: FactoryView | undefined;
  let player: FactoryPlayer | undefined;

  // Кадр приходит до 60 раз в секунду: DOM трогается напрямую и только там, где что-то
  // изменилось, а сигналы Solid меняются лишь при смене состояния.
  const showFrame = (scene: Scene, playback: Playback) => {
    scrubber.value = String(Math.round(scene.time));
    const time = formatClock(scene.recordingTime);
    if (clock.textContent !== time) clock.textContent = time;
    setPlaying(playback.playing);
    setSpeed(playback.speed);

    const current = scene.prompt?.cue ?? null;
    if (current !== cue()) {
      setExpanded(false);
      setCue(current);
    }
    const listener = scene.workers.find((worker) => worker.station === current?.station);
    if (listener !== undefined && bubbleAnchor !== undefined && view !== undefined) {
      placeBubble(bubbleAnchor, view.toScreen(listener.position), floor);
    }
  };

  const toggleRequirements = () => {
    setExpanded(!expanded());
    // Чтобы прочитать уточнения, сцену останавливаем.
    player?.pause();
  };

  onMount(() => {
    let disposed = false;
    onCleanup(() => {
      disposed = true;
      player?.destroy();
      view?.destroy();
    });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    void (async () => {
      let loaded: FactoryView | undefined;
      try {
        loaded = await loadFactoryView();
        await loaded.mount(canvasHost, script().layout);
        if (disposed) {
          loaded.destroy();
          return;
        }
        view = loaded;
        player = new FactoryPlayer({
          script: script(),
          view: loaded,
          container: canvasHost,
          autoplay: !reducedMotion,
          onFrame: showFrame,
        });
        setStatus("ready");
      } catch (err) {
        // Холст и контекст видеокарты не должны остаться под надписью об ошибке.
        loaded?.destroy();
        view = undefined;
        console.error("цех не запустился", err);
        setStatus("failed");
      }
    })();
  });

  return (
    <figure class={styles.factory}>
      <div ref={(element) => (floor = element)} class={styles.floor}>
        {/* Картинка — только холст: пузырь промпта рядом, чтобы его читали и программы чтения. */}
        <div
          ref={(element) => (canvasHost = element)}
          class={styles.canvas}
          role="img"
          aria-label={`Цех проигрывает сборку «${props.recording.title}»`}
        />
        <Show when={status() === "loading"}>
          <p class={styles.notice}>Цех запускается…</p>
        </Show>
        <Show when={status() === "failed"}>
          <p class={styles.notice}>Цех не запустился — попробуйте обновить страницу.</p>
        </Show>
        <Show when={cue()}>
          {(current) => (
            <div ref={(element) => (bubbleAnchor = element)} class={styles.anchor}>
              <div class={styles.bubble}>
                <p class={styles.route}>человек → {recipientOf(current().prompt)}</p>
                <p class={styles.goal}>{current().prompt.goal}</p>
                <Show when={current().prompt.requirements.length > 0}>
                  <button
                    type="button"
                    class={styles.more}
                    aria-expanded={expanded()}
                    onClick={toggleRequirements}
                  >
                    {expanded() ? "свернуть" : "подробнее"}
                  </button>
                  <Show when={expanded()}>
                    <ul class={styles.requirements}>
                      <For each={current().prompt.requirements}>
                        {(requirement) => <li>{requirement}</li>}
                      </For>
                    </ul>
                  </Show>
                </Show>
              </div>
            </div>
          )}
        </Show>
      </div>

      <div class={styles.controls}>
        <button
          type="button"
          class={styles.button}
          disabled={status() !== "ready"}
          aria-label={playing() ? "Пауза" : "Смотреть"}
          onClick={() => player?.toggle()}
        >
          {playing() ? "❚❚" : "▶"}
        </button>
        <input
          ref={(element) => (scrubber = element)}
          class={styles.scrubber}
          type="range"
          min="0"
          max={Math.round(script().duration)}
          step={SCRUB_STEP_MS}
          value="0"
          disabled={status() !== "ready"}
          aria-label="Момент сборки"
          onInput={(event) => player?.seek(Number(event.currentTarget.value))}
        />
        <span
          ref={(element) => (clock = element)}
          class={styles.clock}
          title="Время от начала сборки"
        >
          0:00
        </span>
        <button
          type="button"
          class={styles.button}
          disabled={status() !== "ready"}
          aria-label="Скорость проигрывания"
          onClick={() => player?.cycleSpeed()}
        >
          ×{speed()}
        </button>
      </div>
    </figure>
  );
}
