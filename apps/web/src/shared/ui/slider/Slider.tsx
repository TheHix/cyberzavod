import * as KobalteSlider from "@kobalte/core/slider";
import type { JSX } from "solid-js";
import styles from "./Slider.module.css";

interface Props {
  /** Label for screen readers. */
  label: string;
  value: number;
  max: number;
  step?: number;
  disabled?: boolean;
  /** How to announce the value: "29:04" instead of a number of milliseconds. */
  valueText?: (value: number) => string;
  onChange: (value: number) => void;
}

/**
 * ui-kit slider on Kobalte: mouse, touch and keyboard (arrows, Home, End) come from the library.
 * @param {Props} props Component props.
 * @param {string} props.label Label for screen readers.
 * @param {number} props.value Current value.
 * @param {number} props.max Largest value; the smallest is zero.
 * @param {number} [props.step] Step.
 * @param {boolean} [props.disabled] Whether it is disabled.
 * @param {(value: number) => string} [props.valueText] How to announce the value.
 * @param {(value: number) => void} props.onChange Called on every move.
 * @returns {JSX.Element} Slider.
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
        {/* No KobalteSlider.Input: there is no form, and a hidden field would be announced as
            a second slider. */}
        <KobalteSlider.Thumb
          class={styles.thumb}
          aria-label={props.label}
          aria-valuetext={props.valueText?.(props.value)}
        />
      </KobalteSlider.Track>
    </KobalteSlider.Root>
  );
}
