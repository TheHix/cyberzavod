// Серия сборок в одном цехе: записи идут одна за другой по кругу. Цех при этом не
// пересоздаётся — его модель получает следующую запись через `load`, графика остаётся той же.

import { computed, type ReadableAtom } from "nanostores";
import { nextIndexInCircle } from "@/shared/lib/circle.ts";
import type { SeriesBuild } from "../lib/series-builds.ts";
import { createFactoryModel, type FactoryModel } from "./factory.ts";
import { isAtEnd } from "./playback.ts";

/** Серия сборок в одном цехе: модель цеха и то, какая сборка серии в нём сейчас. */
export interface FactorySeries {
  /** Модель цеха, которая проигрывает серию; запись в ней меняет серия. */
  readonly model: FactoryModel;
  /** Сборка серии, которую сейчас проигрывает цех. */
  readonly $current: ReadableAtom<SeriesBuild>;
  /**
   * Следит за цехом: когда запись сама доиграла до конца, ставит следующую по кругу и
   * продолжает. Пауза человеком серию не двигает — серия ждёт.
   * @returns {() => void} Перестаёт следить.
   */
  follow(): () => void;
}

/**
 * Создаёт серию сборок: цех начинает с первой, а по `follow` сам переходит к следующим.
 * @param {readonly SeriesBuild[]} builds Сборки серии по порядку проигрывания.
 * @returns {FactorySeries} Серия на первой сборке; модель цеха ещё ждёт готовности графики.
 * @throws {Error} Если в серии нет сборок.
 */
export function createFactorySeries(builds: readonly SeriesBuild[]): FactorySeries {
  const [first] = builds;

  if (first === undefined) throw new Error("серия без сборок: цеху нечего проигрывать");

  const model = createFactoryModel(first.recording);
  const indexOf = (recordingId: string) =>
    builds.findIndex((build) => build.recording.id === recordingId);
  const $index = computed(model.$recordingId, indexOf);
  // Запись в цех ставит только серия, поэтому номер всегда в её пределах.
  const $current = computed($index, (index) => builds[index] ?? first);

  const playNext = () => {
    const nextIndex = nextIndexInCircle($index.get(), builds.length);
    const next = builds[nextIndex] ?? first;

    model.load(next.recording);
    model.play();
  };

  return {
    model,
    $current,
    follow: () =>
      // Сцена сама встаёт только в конце записи. Пауза человека ставит её раньше конца, а
      // перемотка на паузе не пускает сцену — в обоих случаях серия ждёт.
      model.$playing.listen((playing) => {
        const hasFinished = !playing && isAtEnd(model.$playback.get());

        if (hasFinished) playNext();
      }),
  };
}
