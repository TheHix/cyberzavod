import { createSignal, onCleanup, onMount, Show, untrack, type JSX } from "solid-js";
import type { Recording } from "@cyberzavod/core";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import {
  loadFactoryGraphics,
  type FactoryGraphics,
  type Frame,
} from "../graphics/factory-graphics.ts";
import { createFactoryModel, type FactoryModel } from "../model/factory.ts";
import { startFrameClock } from "./frame-clock.ts";
import { Hud } from "./Hud.tsx";
import { FactoryModelProvider } from "./model-context.ts";
import { PromptBubble } from "./PromptBubble.tsx";
import styles from "./Factory.module.css";

interface Props {
  recording: Recording;
  /** Уровень заголовка с названием сборки; по умолчанию — главный заголовок страницы. */
  titleLevel?: "h1" | "h2" | undefined;
}

interface LaunchedFactory {
  readonly graphics: FactoryGraphics;
  readonly stop: () => void;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

// Встраивает графику в холст и запускает цех: кадр рисуется по подписке на сцену модели —
// идёт она или её перематывают, — а часы двигают модель.
async function launchFactory(model: FactoryModel, host: HTMLElement): Promise<LaunchedFactory> {
  const graphics = await loadFactoryGraphics();
  try {
    await graphics.mount(host, model.script.layout);
  } catch (err) {
    // Холст и контекст видеокарты не должны остаться под надписью об ошибке.
    graphics.destroy();
    throw err;
  }
  const stopRendering = model.$scene.subscribe((scene) => graphics.render(scene));
  const stopClock = startFrameClock(model, host);
  return {
    graphics,
    stop: () => {
      stopClock();
      stopRendering();
      graphics.destroy();
    },
  };
}

// Поле в координатах холста: холст на всё окно, поле — свободное место между меню и HUD.
function fieldWithin(host: HTMLElement, field: HTMLElement): Frame {
  const outer = host.getBoundingClientRect();
  const inner = field.getBoundingClientRect();
  return {
    x: inner.left - outer.left,
    y: inner.top - outer.top,
    width: inner.width,
    height: inner.height,
  };
}

/**
 * Живой цех на весь экран: проигрывает запись сборки — рабочие у станков, бег с деталью,
 * промпты над рабочими, HUD сборки справа. Графика грузится только в браузере.
 * @param {Props} props Свойства компонента.
 * @param {Recording} props.recording Запись сборки, которую проигрывает цех.
 * @param {"h1" | "h2"} [props.titleLevel] Уровень заголовка с названием сборки.
 * @returns {JSX.Element} Цех с HUD.
 */
export function Factory(props: Props): JSX.Element {
  // Запись у островка не меняется: модель создаётся один раз.
  const model = createFactoryModel(untrack(() => props.recording));
  const status = useStoreValue(model.$status);
  const [graphics, setGraphics] = createSignal<FactoryGraphics>();
  const [field, setField] = createSignal<Frame>({ x: 0, y: 0, width: 0, height: 0 });
  // Элементы задаются в разметке через ref и живут столько же, сколько компонент.
  let canvasHost!: HTMLDivElement;
  let fieldElement!: HTMLDivElement;

  // Сначала графика подстраивается под размер, потом размер видят компоненты: иначе
  // пузырь промпта на паузе встал бы по старому масштабу.
  const fitToScreen = () => {
    const frame = fieldWithin(canvasHost, fieldElement);
    graphics()?.resize(canvasHost.clientWidth, canvasHost.clientHeight, frame);
    graphics()?.render(model.$scene.get());
    setField(frame);
  };

  onMount(() => {
    let stop: (() => void) | undefined;
    let disposed = false;
    const resizeObserver = new ResizeObserver(fitToScreen);
    resizeObserver.observe(canvasHost);
    resizeObserver.observe(fieldElement);
    onCleanup(() => {
      disposed = true;
      resizeObserver.disconnect();
      stop?.();
    });

    launchFactory(model, canvasHost).then(
      (launched) => {
        if (disposed) {
          launched.stop();
          return;
        }
        stop = launched.stop;
        setGraphics(launched.graphics);
        fitToScreen();
        model.start(!window.matchMedia(REDUCED_MOTION).matches);
      },
      (err: unknown) => {
        console.error("цех не запустился", err);
        model.fail();
      },
    );
  });

  return (
    <FactoryModelProvider value={model}>
      <div class={styles.factory}>
        {/* Картинка — только холст: пузырь промпта рядом, его читают и программы чтения. */}
        <div
          ref={(element) => (canvasHost = element)}
          class={styles.canvas}
          role="img"
          aria-label={`Цех проигрывает сборку «${props.recording.title}»`}
        />
        <div ref={(element) => (fieldElement = element)} class={styles.field}>
          <Show when={status() === "loading"}>
            <p class={styles.notice}>Цех запускается…</p>
          </Show>
          <Show when={status() === "failed"}>
            <p class={styles.notice}>Цех не запустился — попробуйте обновить страницу.</p>
          </Show>
        </div>
        <Hud recording={props.recording} titleLevel={props.titleLevel ?? "h1"} />
        <div class={styles.overlay}>
          <PromptBubble graphics={graphics()} field={field()} />
        </div>
      </div>
    </FactoryModelProvider>
  );
}
