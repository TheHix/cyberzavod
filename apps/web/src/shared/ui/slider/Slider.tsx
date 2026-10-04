import * as KobalteSlider from "@kobalte/core/slider";
import type { JSX } from "solid-js";
import styles from "./Slider.module.css";

interface Props {
  /** Подпись для программ чтения с экрана. */
  label: string;
  value: number;
  max: number;
  step?: number;
  disabled?: boolean;
  /** Как озвучить значение: «29:04» вместо числа миллисекунд. */
  valueText?: (value: number) => string;
  onChange: (value: number) => void;
}

/**
 * Слайдер ui-kit на Kobalte: мышь, касание и клавиатура (стрелки, Home, End) — от библиотеки.
 * @param {Props} props Свойства компонента.
 * @param {string} props.label Подпись для программ чтения с экрана.
 * @param {number} props.value Текущее значение.
 * @param {number} props.max Наибольшее значение; наименьшее — ноль.
 * @param {number} [props.step] Шаг.
 * @param {boolean} [props.disabled] Выключен ли.
 * @param {(value: number) => string} [props.valueText] Как озвучить значение.
 * @param {(value: number) => void} props.onChange Вызывается при каждом сдвиге.
 * @returns {JSX.Element} Слайдер.
 */
export function Slider(props: Props): JSX.Element {
  return (
    <KobalteSlider.Root
      class={styles.slider}
      value={[props.value]}
      maxValue={props.max}
      step={props.step ?? 1}
      disabled={props.disabled ?? false}
      onChange={([value]) => props.onChange(value ?? 0)}
    >
      <KobalteSlider.Track class={styles.track}>
        <KobalteSlider.Fill class={styles.fill} />
        {/* Без KobalteSlider.Input: формы нет, а скрытое поле читалось бы вторым слайдером. */}
        <KobalteSlider.Thumb
          class={styles.thumb}
          aria-label={props.label}
          aria-valuetext={props.valueText?.(props.value)}
        />
      </KobalteSlider.Track>
    </KobalteSlider.Root>
  );
}
