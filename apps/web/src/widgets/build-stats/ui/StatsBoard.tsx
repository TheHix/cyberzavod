import { onMount, Show, type JSX } from "solid-js";
import { fetchStats, type BuildStats } from "@/entities/stats";
import { readyValue } from "@/shared/api/remote.ts";
import { remoteNoticeOf } from "@/shared/api/remote-notice.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { BarList, StatList, Title, type BarItem } from "@/shared/ui";
import { statsViewOf } from "../lib/stats-view.ts";
import { createStatsPageModel } from "../model/stats-page.ts";
import styles from "./StatsBoard.module.css";

interface Props {
  /** Язык страницы: на нём подписи, числа и сообщения. */
  locale: Locale;
}

interface ChartProps {
  heading: string;
  items: readonly BarItem[];
  locale: Locale;
}

interface FilledProps {
  stats: BuildStats;
  locale: Locale;
}

function Chart(props: ChartProps): JSX.Element {
  return (
    <section class={styles.section}>
      <Title as="h2">{props.heading}</Title>
      <Show
        when={props.items.length > 0}
        fallback={<p class={styles.note}>{UI_TEXT.stats.none[props.locale]}</p>}
      >
        <BarList items={props.items} />
      </Show>
    </section>
  );
}

function StatsCharts(props: FilledProps): JSX.Element {
  const filledView = () => {
    const view = statsViewOf(props.stats, props.locale);

    return view.kind === "filled" ? view : undefined;
  };

  return (
    <Show
      when={filledView()}
      fallback={<p class={styles.note}>{UI_TEXT.stats.empty[props.locale]}</p>}
    >
      {(view) => (
        <div class={styles.board}>
          <StatList items={view().totals} />
          <Chart
            heading={UI_TEXT.stats.returnsHeading[props.locale]}
            items={view().returns}
            locale={props.locale}
          />
          <Chart
            heading={UI_TEXT.stats.interventionsHeading[props.locale]}
            items={view().interventions}
            locale={props.locale}
          />
          <Chart
            heading={UI_TEXT.stats.outcomesHeading[props.locale]}
            items={view().outcomes}
            locale={props.locale}
          />
        </div>
      )}
    </Show>
  );
}

/**
 * Аналитика по записям открытых галерей: числа и диаграммы возвратов по этапам, вмешательств по
 * причинам и исходов сборок. Данные приходят из API в браузере; пока сборок нет — заглушка.
 * @param {Props} props Свойства компонента.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Аналитика или сообщение, почему её нет.
 */
export function StatsBoard(props: Props): JSX.Element {
  const model = createStatsPageModel(() => fetchStats());
  const state = useStoreValue(model.$stats);

  onMount(() => void model.load());

  // Аналитика есть всегда, даже пустая: 404 значит, что API её не отдаёт, — это неудача запроса.
  return (
    <Show
      when={readyValue(state())}
      fallback={
        <p class={styles.note}>{remoteNoticeOf(state(), UI_TEXT.remote.failed, props.locale)}</p>
      }
    >
      {(stats) => <StatsCharts stats={stats()} locale={props.locale} />}
    </Show>
  );
}
