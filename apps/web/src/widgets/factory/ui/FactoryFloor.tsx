import { createSignal, onCleanup, onMount, Show, untrack, type JSX } from "solid-js";
import { layoutFor } from "@cyberzavod/player";
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
import type { BuildProject } from "../lib/build-project.ts";
import type { SeriesPosition } from "../lib/series-builds.ts";
import type { FactoryModel } from "../model/factory.ts";
import { startFrameClock } from "./frame-clock.ts";
import { Hud } from "./Hud.tsx";
import { InterventionBubble } from "./InterventionBubble.tsx";
import { MessageBubble } from "./MessageBubble.tsx";
import { FactoryModelProvider } from "./model-context.ts";
import { PromptBubble } from "./PromptBubble.tsx";
import { prefersReducedMotion } from "./reduced-motion.ts";
import styles from "./Factory.module.css";

interface Props {
  /** Factory model: one recording or a series, created by whoever puts the floor on the page. */
  model: FactoryModel;
  /** Page language: floor, HUD and bubble captions are in it. */
  locale: Locale;
  /**
   * The project that was built, in the HUD; a link to its page or the author's gallery, if any.
   */
  project: BuildProject;
  /**
   * Note about the recording's original language; absent if the recording is in the page language.
   */
  languageNote: string | undefined;
  /** Place of the build in its project's series; absent for a single recording. */
  position: SeriesPosition | undefined;
  /** Level of the heading with the build name. */
  titleLevel: "h1" | "h2";
  /** Content above the floor in its column, beside the HUD; the floor fits into the rest. */
  children?: JSX.Element | undefined;
}

interface LaunchedFactory {
  readonly graphics: FactoryGraphics;
  readonly stop: () => void;
}

// Embeds the graphics into the canvas and starts the floor: a frame is drawn on subscription to the
// model's scene, whether it runs or is being rewound, and the clock moves the model.
async function launchFactory(
  model: FactoryModel,
  host: HTMLElement,
  locale: Locale,
): Promise<LaunchedFactory> {
  const graphics = await loadFactoryGraphics(locale);

  try {
    const mounted = model.$layout.get();

    await graphics.mount(host, mounted);
    // While the canvas was being embedded, the field shape may have changed the plan: the graphics
    // did not know it yet. `fitToScreen` fits it right after the start.
    if (model.$layout.get() !== mounted) graphics.setLayout(model.$layout.get());
  } catch (err) {
    // The canvas and the GPU context must not stay under the error message.
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

// The field in canvas coordinates: the canvas fills the window, the field is the free space between
// the menu and the HUD.
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
 * A live full-screen factory from a ready model: workers at machines, running with the part, the
 * foreman's office, prompts, interventions and messages above the speakers, the build HUD on the
 * right with a project link. The recording in the model may change, while the canvas and graphics
 * stay. The graphics load only in the browser.
 * @param {Props} props Component props.
 * @param {FactoryModel} props.model Factory model.
 * @param {Locale} props.locale Page language.
 * @param {BuildProject} props.project The project that was built.
 * @param {string | undefined} props.languageNote Note about the recording's original language.
 * @param {SeriesPosition | undefined} props.position Place of the build in its project's series.
 * @param {"h1" | "h2"} props.titleLevel Level of the heading with the build name.
 * @param {JSX.Element} [props.children] Content above the floor in its column.
 * @returns {JSX.Element} The factory with the HUD.
 */
export function FactoryFloor(props: Props): JSX.Element {
  // The floor's model does not change: the recording inside it does.
  const model = untrack(() => props.model);
  // The page language is known at build time and does not change for the island.
  const locale = untrack(() => props.locale);
  const status = useStoreValue(model.$status);
  const recording = useStoreValue(model.$recording);
  const [graphics, setGraphics] = createSignal<FactoryGraphics>();
  const [field, setField] = createSignal<Frame>({ x: 0, y: 0, width: 0, height: 0 });
  // The elements are set in the markup via ref and live as long as the component.
  let canvasHost!: HTMLDivElement;
  let fieldElement!: HTMLDivElement;

  // A hidden field has no shape: the plan stays the same. The canvas fills the window, its size is
  // the screen.
  const layoutForField = (frame: Frame) => {
    const hasArea = frame.width > 0 && frame.height > 0;

    if (!hasArea) return model.$layout.get();

    return layoutFor(frame, { width: canvasHost.clientWidth, height: canvasHost.clientHeight });
  };

  // First the graphics adapt to the size, then the components see the size: otherwise a paused
  // bubble would be placed by the old scale. The field and screen shape may require another plan:
  // the graphics change it before the model, so a frame is not drawn by a wrong plan, and `resize`
  // fits it into the field at once.
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
    // The plan is chosen by the field and the screen before the graphics start: they draw the right
    // one at once.
    model.setLayout(layoutForField(fieldWithin(canvasHost, fieldElement)));
    onCleanup(connectScene(model));
    let stop: (() => void) | undefined;
    let isDisposed = false;
    const resizeObserver = new ResizeObserver(fitToScreen);

    resizeObserver.observe(canvasHost);
    resizeObserver.observe(fieldElement);
    onCleanup(() => {
      isDisposed = true;
      resizeObserver.disconnect();
      stop?.();
    });

    launchFactory(model, canvasHost, locale).then(
      (launched) => {
        if (isDisposed) {
          launched.stop();

          return;
        }

        stop = launched.stop;
        setGraphics(launched.graphics);
        fitToScreen();
        model.start(!prefersReducedMotion());
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
          {/* The picture is only the canvas: the prompt, intervention and message bubbles are next
             to it, screen readers read them */}
          <div
            ref={(element) => (canvasHost = element)}
            class={styles.canvas}
            role="img"
            aria-label={UI_TEXT.factory.canvasLabel[locale](recording().data.title)}
          />
          <div class={styles.column}>
            {props.children}
            <div ref={(element) => (fieldElement = element)} class={styles.field}>
              <Show when={status() === "loading"}>
                <p class={styles.notice}>{UI_TEXT.factory.starting[locale]}</p>
              </Show>
              <Show when={status() === "failed"}>
                <p class={styles.notice}>{UI_TEXT.factory.failed[locale]}</p>
              </Show>
            </div>
          </div>
          <Hud
            project={props.project}
            languageNote={props.languageNote}
            position={props.position}
            titleLevel={props.titleLevel}
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
