import { untrack, type JSX } from "solid-js";
import { type BriefSessionRecord } from "@cyberzavod/core";
import type { Locale } from "@/shared/i18n/locale.ts";
import type { BuildProject } from "../lib/build-project.ts";
import { createFactoryModel } from "../model/factory.ts";
import { FactoryFloor } from "./FactoryFloor.tsx";

interface Props {
  recording: BriefSessionRecord;
  /** Язык страницы: на нём подписи цеха, HUD и пузырей. */
  locale: Locale;
  /** Проект, который собирали, — в HUD; ссылка на его страницу или галерею автора, если есть. */
  project: BuildProject;
  /** Пометка о языке оригинала записи; нет, если запись на языке страницы. */
  languageNote: string | undefined;
  /** Уровень заголовка с названием сборки; по умолчанию — главный заголовок страницы. */
  titleLevel?: "h1" | "h2" | undefined;
}

/**
 * Живой цех на весь экран, который проигрывает одну запись сборки: рабочие у станков, бег с
 * деталью, кабинет мастера, промпты, вмешательства и реплики над говорящими, HUD сборки справа
 * со ссылкой на проект. Графика грузится только в браузере.
 * @param {Props} props Свойства компонента.
 * @param {BriefSessionRecord} props.recording Запись сборки, которую проигрывает цех.
 * @param {Locale} props.locale Язык страницы.
 * @param {BuildProject} props.project Проект, который собирали.
 * @param {string | undefined} props.languageNote Пометка о языке оригинала записи.
 * @param {"h1" | "h2"} [props.titleLevel] Уровень заголовка с названием сборки.
 * @returns {JSX.Element} Цех с HUD.
 */
export function Factory(props: Props): JSX.Element {
  // Запись у островка не меняется: модель создаётся один раз.
  const model = createFactoryModel(untrack(() => props.recording));

  return (
    <FactoryFloor
      model={model}
      locale={props.locale}
      project={props.project}
      languageNote={props.languageNote}
      position={undefined}
      titleLevel={props.titleLevel ?? "h1"}
    />
  );
}
