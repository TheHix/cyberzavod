import X from "lucide-solid/icons/x";
import type { JSX } from "solid-js";
import { Button } from "../button/Button.tsx";
import styles from "./Drawer.module.css";

const ICON_STROKE = 3;

interface Props {
  /** id панели: его указывают кнопки, которые её открывают (`popovertarget`). */
  id: string;
  title: string;
  /** Подпись кнопки закрытия на языке страницы: kit словаря не знает. */
  closeLabel: string;
  children: JSX.Element;
}

/**
 * Выезжающая панель ui-kit на нативном popover: без JS открывается кнопкой с
 * `popovertarget`, закрывается по Esc и кликом мимо, а содержимое всегда есть в HTML.
 * @param {Props} props Свойства компонента.
 * @param {string} props.id Идентификатор панели.
 * @param {string} props.title Заголовок панели.
 * @param {string} props.closeLabel Подпись кнопки закрытия.
 * @param {JSX.Element} props.children Содержимое.
 * @returns {JSX.Element} Панель, скрытая до открытия.
 */
export function Drawer(props: Props): JSX.Element {
  const titleId = () => `${props.id}-title`;

  return (
    <aside id={props.id} popover="auto" class={styles.drawer} aria-labelledby={titleId()}>
      <header class={styles.header}>
        <h2 id={titleId()} class={styles.title}>
          {props.title}
        </h2>
        <Button
          layout="icon"
          popovertarget={props.id}
          popovertargetaction="hide"
          aria-label={props.closeLabel}
        >
          <X stroke-width={ICON_STROKE} />
        </Button>
      </header>
      <div class={styles.body}>{props.children}</div>
    </aside>
  );
}
