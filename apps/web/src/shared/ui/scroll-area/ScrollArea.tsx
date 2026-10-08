import { createSignal, onCleanup, type JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./ScrollArea.module.css";

interface Props {
  /** Высота и раскладка снаружи: предел высоты или место во флекс-колонке, промежутки. */
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * Блок ui-kit на бумаге, содержимое которого прокручивается внутри, когда не помещается в высоту,
 * отведённую ему снаружи: колесо, палец и клавиатура прокручивают его, а не страницу. Тень у края
 * показывает, что за ним есть ещё текст.
 * @param {Props} props Свойства компонента.
 * @param {string} [props.class] Высота и раскладка снаружи.
 * @param {JSX.Element} props.children Содержимое.
 * @returns {JSX.Element} Прокручиваемый блок.
 */
export function ScrollArea(props: Props): JSX.Element {
  const [isOverflowing, setOverflowing] = createSignal(false);

  // Содержимое меняется и без смены размера блока — раскрылся список, а блок уже на пределе
  // высоты, — поэтому за ним следит и MutationObserver.
  const watchOverflow = (area: HTMLDivElement) => {
    const checkOverflow = () => setOverflowing(area.scrollHeight > area.clientHeight);
    const resizes = new ResizeObserver(checkOverflow);
    const mutations = new MutationObserver(checkOverflow);

    resizes.observe(area);
    mutations.observe(area, { childList: true, subtree: true, characterData: true });
    onCleanup(() => {
      resizes.disconnect();
      mutations.disconnect();
    });
  };

  return (
    <div
      ref={watchOverflow}
      class={cx(styles.area, props.class)}
      // Без ссылок и кнопок внутри блок не получил бы фокус, и с клавиатуры его было бы не
      // прокрутить; пока прокручивать нечего, он не лишняя остановка Tab.
      tabindex={isOverflowing() ? 0 : undefined}
      data-overflowing={isOverflowing() ? "" : undefined}
    >
      {props.children}
    </div>
  );
}
