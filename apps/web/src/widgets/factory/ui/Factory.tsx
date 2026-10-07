import { createSignal, onCleanup, onMount, Show, untrack, type JSX } from "solid-js";
import { layoutFor, type BriefSessionRecord } from "@cyberzavod/core";
import type { ProjectLink } from "@/entities/project";
import { connectScene } from "@/features/journal-sync";
import { LocaleProvider } from "@/shared/i18n/locale-context.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import {
  loadFactoryGraphics,
  type FactoryGraphics,
  type Frame,
} from "../graphics/factory-graphics.ts";
import { createFactoryModel, type FactoryModel } from "../model/factory.ts";
import { startFrameClock } from "./frame-clock.ts";
import { Hud } from "./Hud.tsx";
import { InterventionBubble } from "./InterventionBubble.tsx";
import { MessageBubble } from "./MessageBubble.tsx";
import { FactoryModelProvider } from "./model-context.ts";
import { PromptBubble } from "./PromptBubble.tsx";
import styles from "./Factory.module.css";

interface Props {
  recording: BriefSessionRecord;
  /** Язык страницы: на нём подписи цеха, HUD и пузырей. */
  locale: Locale;
  /** Проект, который собирали, — ссылка на его страницу в HUD. */
  project: ProjectLink;
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
async function launchFactory(
  model: FactoryModel,
  host: HTMLElement,
  locale: Locale,
): Promise<LaunchedFactory> {
  const graphics = await loadFactoryGraphics(locale);
  try {
    const mounted = model.$layout.get();
    await graphics.mount(host, mounted);
    // Пока холст встраивался, форма поля могла сменить план: графика его ещё не знала.
    // Вписывает его `fitToScreen` сразу после запуска.
    if (model.$layout.get() !== mounted) graphics.setLayout(model.$layout.get());
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
 * кабинет мастера, промпты, вмешательства и реплики над говорящими, HUD сборки справа со ссылкой на проект.
 * Графика грузится только в браузере.
 * @param {Props} props Свойства компонента.
 * @param {BriefSessionRecord} props.recording Запись сборки, которую проигрывает цех.
 * @param {Locale} props.locale Язык страницы.
 * @param {ProjectLink} props.project Проект, который собирали.
 * @param {"h1" | "h2"} [props.titleLevel] Уровень заголовка с названием сборки.
 * @returns {JSX.Element} Цех с HUD.
 */
export function Factory(props: Props): JSX.Element {
  // Запись у островка не меняется: модель создаётся один раз.
  const model = createFactoryModel(untrack(() => props.recording));
  // Язык страницы известен при сборке и у островка не меняется.
  const locale = untrack(() => props.locale);
  const status = useStoreValue(model.$status);
  const [graphics, setGraphics] = createSignal<FactoryGraphics>();
  const [field, setField] = createSignal<Frame>({ x: 0, y: 0, width: 0, height: 0 });
  // Элементы задаются в разметке через ref и живут столько же, сколько компонент.
  let canvasHost!: HTMLDivElement;
  let fieldElement!: HTMLDivElement;

  // У скрытого поля нет формы: план остаётся прежним. Холст на всё окно, его размер — экран.
  const layoutForField = (frame: Frame) =>
    frame.width > 0 && frame.height > 0
      ? layoutFor(frame, { width: canvasHost.clientWidth, height: canvasHost.clientHeight })
      : model.$layout.get();

  // Сначала графика подстраивается под размер, потом размер видят компоненты: иначе
  // пузырь на паузе встал бы по старому масштабу. Форма поля и экрана может потребовать другой план:
  // графика меняет его раньше модели, чтобы кадр не рисовался по чужому плану, а `resize`
  // сразу вписывает его в поле.
  const fitToScreen = () => {
    const frame = fieldWithin(canvasHost, fieldElement);
    const layout = layoutForField(frame);
    if (layout !== model.$layout.get()) {
      graphics()?.setLayout(layout);
      model.setLayout(layout);
    }
    graphics()?.resize(canvasHost.clientWidth, canvasHost.clientHeight, frame);
    graphics()?.render(model.$scene.get());
    setField(frame);
  };

  onMount(() => {
    // План выбирается по полю и экрану до запуска графики: она сразу рисует нужный.
    model.setLayout(layoutForField(fieldWithin(canvasHost, fieldElement)));
    onCleanup(connectScene(model));
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

    launchFactory(model, canvasHost, locale).then(
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
    <LocaleProvider value={locale}>
      <FactoryModelProvider value={model}>
        <div class={styles.factory}>
          {/* Картинка — только холст: пузыри промпта, вмешательства и реплики рядом, их читают программы чтения */}
          <div
            ref={(element) => (canvasHost = element)}
            class={styles.canvas}
            role="img"
            aria-label={UI_TEXT.factory.canvasLabel[locale](props.recording.data.title)}
          />
          <div ref={(element) => (fieldElement = element)} class={styles.field}>
            <Show when={status() === "loading"}>
              <p class={styles.notice}>{UI_TEXT.factory.starting[locale]}</p>
            </Show>
            <Show when={status() === "failed"}>
              <p class={styles.notice}>{UI_TEXT.factory.failed[locale]}</p>
            </Show>
          </div>
          <Hud
            recording={props.recording}
            project={props.project}
            titleLevel={props.titleLevel ?? "h1"}
          />
          <div class={styles.overlay}>
            <PromptBubble graphics={graphics()} field={field()} />
            <InterventionBubble graphics={graphics()} field={field()} />
            <MessageBubble graphics={graphics()} field={field()} />
          </div>
        </div>
      </FactoryModelProvider>
    </LocaleProvider>
  );
}
