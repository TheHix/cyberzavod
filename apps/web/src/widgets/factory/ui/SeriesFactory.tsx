import { onCleanup, onMount, untrack, type JSX } from "solid-js";
import type { Locale } from "@/shared/i18n/locale.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import type { SeriesBuild } from "../lib/series-builds.ts";
import { createFactorySeries } from "../model/series.ts";
import { FactoryFloor } from "./FactoryFloor.tsx";
import { prefersReducedMotion } from "./reduced-motion.ts";

interface Props {
  /** Сборки серии по порядку проигрывания; хотя бы одна. */
  builds: readonly SeriesBuild[];
  /** Язык страницы: на нём подписи цеха, HUD и пузырей. */
  locale: Locale;
  /** Уровень заголовка с названием сборки; по умолчанию — главный заголовок страницы. */
  titleLevel?: "h1" | "h2" | undefined;
}

/**
 * Цех, который проигрывает серию сборок по кругу: досмотренную запись сменяет следующая, в HUD —
 * её проект и «сборка 2 из 7». Холст и графика при смене записи остаются. Пауза человеком серию
 * останавливает; при просьбе уменьшить движение серия сама не идёт и не переходит дальше.
 * @param {Props} props Свойства компонента.
 * @param {readonly SeriesBuild[]} props.builds Сборки серии по порядку проигрывания.
 * @param {Locale} props.locale Язык страницы.
 * @param {"h1" | "h2"} [props.titleLevel] Уровень заголовка с названием сборки.
 * @returns {JSX.Element} Цех с HUD.
 */
export function SeriesFactory(props: Props): JSX.Element {
  // Серия у островка не меняется: модель цеха и серия создаются один раз.
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
    />
  );
}
