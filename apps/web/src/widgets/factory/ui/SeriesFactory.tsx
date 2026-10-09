import { onCleanup, onMount, untrack, type JSX } from "solid-js";
import type { Locale } from "@/shared/i18n/locale.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import type { SeriesBuild } from "../lib/series-builds.ts";
import { createFactorySeries } from "../model/series.ts";
import { FactoryFloor } from "./FactoryFloor.tsx";
import { prefersReducedMotion } from "./reduced-motion.ts";

interface Props {
  /** Series builds in playback order; at least one. */
  builds: readonly SeriesBuild[];
  /** Page language: floor, HUD and bubble captions are in it. */
  locale: Locale;
  /** Level of the heading with the build name; by default the main page heading. */
  titleLevel?: "h1" | "h2" | undefined;
  /** Content above the floor in its column, beside the HUD. */
  children?: JSX.Element | undefined;
}

/**
 * A factory that plays a build series in a loop: a finished recording is followed by the next, the
 * HUD shows its project and "build 2 of 7". The canvas and graphics stay when the recording
 * changes. A pause by the human stops the series; when reduced motion is requested, the series
 * neither runs nor moves on by itself.
 * @param {Props} props Component props.
 * @param {readonly SeriesBuild[]} props.builds Series builds in playback order.
 * @param {Locale} props.locale Page language.
 * @param {"h1" | "h2"} [props.titleLevel] Level of the heading with the build name.
 * @param {JSX.Element} [props.children] Content above the floor in its column.
 * @returns {JSX.Element} The factory with the HUD.
 */
export function SeriesFactory(props: Props): JSX.Element {
  // The island's series does not change: the factory model and the series are created once.
  const series = createFactorySeries(untrack(() => props.builds));
  const current = useStoreValue(series.$current);

  onMount(() => {
    if (prefersReducedMotion()) return;

    onCleanup(series.follow());
  });

  return (
    <FactoryFloor
      model={series.model}
      locale={props.locale}
      project={current().project}
      languageNote={current().languageNote}
      position={current().position}
      titleLevel={props.titleLevel ?? "h1"}
    >
      {props.children}
    </FactoryFloor>
  );
}
