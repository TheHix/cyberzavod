import ChevronRight from "lucide-solid/icons/chevron-right";
import type { JSX } from "solid-js";
import styles from "./Disclosure.module.css";

const ICON_STROKE = 3;

interface Props {
  /**
   * Шапка: видна всегда, нажатие по ней сворачивает и разворачивает содержимое. Из `.astro` —
   * слотом `summary`, поэтому для типов она необязательна.
   */
  summary?: JSX.Element;
  /** Раскрыт ли блок, пока его не свернули. */
  open?: boolean | undefined;
  children: JSX.Element;
}

/**
 * Сворачиваемый блок ui-kit на нативных `<details>` и `<summary>`: сворачивается без JS и без
 * острова, клавиатура и состояние для программ чтения — от браузера. Стрелка у шапки
 * поворачивается, когда блок раскрыт.
 * @param {Props} props Свойства компонента.
 * @param {JSX.Element} [props.summary] Шапка блока: строчное содержимое, без ссылок и кнопок.
 * @param {boolean} [props.open] Раскрыт ли блок сначала; по умолчанию свёрнут.
 * @param {JSX.Element} props.children Содержимое, которое сворачивается.
 * @returns {JSX.Element} Сворачиваемый блок.
 */
export function Disclosure(props: Props): JSX.Element {
  return (
    <details class={styles.disclosure} open={props.open}>
      <summary class={styles.summary}>
        <span class={styles.marker} aria-hidden="true">
          <ChevronRight stroke-width={ICON_STROKE} />
        </span>
        <span class={styles.heading}>{props.summary}</span>
      </summary>
      <div class={styles.body}>{props.children}</div>
    </details>
  );
}
