import BookOpen from "lucide-solid/icons/book-open";
import Factory from "lucide-solid/icons/factory";
import FolderKanban from "lucide-solid/icons/folder-kanban";
import Info from "lucide-solid/icons/info";
import ListVideo from "lucide-solid/icons/list-video";
import MessageSquareText from "lucide-solid/icons/message-square-text";
import { Show, type JSX } from "solid-js";
import { PANELS } from "@/shared/config/panels.ts";
import { site } from "@/shared/config/site.ts";
import { Button, ButtonLink } from "@/shared/ui";
import { GithubMark } from "./GithubMark.tsx";
import styles from "./Sidebar.module.css";

interface Props {
  /** Есть ли на странице журнал сборки — тогда в меню его кнопка. */
  journal: boolean;
  /** Есть ли на странице карточка проекта — тогда в меню кнопка «Проект». */
  project: boolean;
}

const ICON_STROKE = 2.5;

/**
 * Меню сайта слева: логотип, цех, панели записей, журнала сборки, проекта, гайдов и «о заводе»,
 * ссылка на код.
 * Работает без JavaScript: панели открываются нативным popover.
 * @param {Props} props Свойства компонента.
 * @param {boolean} props.journal Показывать ли кнопку журнала сборки.
 * @param {boolean} props.project Показывать ли кнопку проекта.
 * @returns {JSX.Element} Боковое меню.
 */
export function Sidebar(props: Props): JSX.Element {
  return (
    <nav class={styles.sidebar} aria-label="Меню">
      <a class={styles.logo} href="/" aria-label={`${site.name} — цех`}>
        <span class={styles.badge} aria-hidden="true">
          КЗ
        </span>
        <span class={styles.logoText}>
          Кибер
          <br />
          завод
        </span>
      </a>
      <ul class={styles.menu}>
        <li>
          <ButtonLink href="/" layout="tile">
            <Factory stroke-width={ICON_STROKE} />
            Цех
          </ButtonLink>
        </li>
        <li>
          <Button layout="tile" popovertarget={PANELS.records}>
            <ListVideo stroke-width={ICON_STROKE} />
            Записи
          </Button>
        </li>
        <Show when={props.journal}>
          <li>
            <Button layout="tile" popovertarget={PANELS.journal}>
              <MessageSquareText stroke-width={ICON_STROKE} />
              Журнал
            </Button>
          </li>
        </Show>
        <Show when={props.project}>
          <li>
            <Button layout="tile" popovertarget={PANELS.project}>
              <FolderKanban stroke-width={ICON_STROKE} />
              Проект
            </Button>
          </li>
        </Show>
        <li>
          <Button layout="tile" popovertarget={PANELS.guides}>
            <BookOpen stroke-width={ICON_STROKE} />
            Гайды
          </Button>
        </li>
        <li>
          <Button layout="tile" popovertarget={PANELS.about}>
            <Info stroke-width={ICON_STROKE} />О заводе
          </Button>
        </li>
      </ul>
      <ButtonLink class={styles.bottom} href={site.repoUrl} layout="tile" variant="ghost">
        <GithubMark />
        Код
      </ButtonLink>
    </nav>
  );
}
