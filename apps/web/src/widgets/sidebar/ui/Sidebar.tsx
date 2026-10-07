import BookOpen from "lucide-solid/icons/book-open";
import Factory from "lucide-solid/icons/factory";
import FolderKanban from "lucide-solid/icons/folder-kanban";
import Info from "lucide-solid/icons/info";
import Languages from "lucide-solid/icons/languages";
import ListVideo from "lucide-solid/icons/list-video";
import MessageSquareText from "lucide-solid/icons/message-square-text";
import { For, Show, type JSX } from "solid-js";
import { PANELS } from "@/shared/config/panels.ts";
import { LOGO_LINES, LOGO_SHORT_LINES } from "@/shared/config/logo.ts";
import { site } from "@/shared/config/site.ts";
import { LOCALE_NAMES, otherLocales, type Locale } from "@/shared/i18n/locale.ts";
import { localizedPath } from "@/shared/i18n/path.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { cx } from "@/shared/lib/cx.ts";
import { Button, ButtonLink, GithubMark, PixelPlaque } from "@/shared/ui";
import styles from "./Sidebar.module.css";

interface Props {
  /** Есть ли на странице журнал сборки — тогда в меню его кнопка. */
  journal: boolean;
  /** Есть ли на странице карточка проекта — тогда в меню кнопка «Проект». */
  project: boolean;
  /** Язык страницы: на нём подписи меню. */
  locale: Locale;
  /** Путь страницы без языка: по нему переключатель ведёт на ту же страницу на другом языке. */
  path: string;
  /**
   * Вход через GitHub — остров, который ставит страница: меню рисуется без JS. На узком и низком
   * экране его нет — он в панели записей.
   */
  account?: JSX.Element;
}

const ICON_STROKE = 2.5;

/**
 * Меню сайта слева: логотип, цех, панели записей, журнала сборки, проекта, гайдов и «о заводе»,
 * вход через GitHub, ссылка на код и переключатель языка.
 * Работает без JavaScript: панели открываются нативным popover.
 * @param {Props} props Свойства компонента.
 * @param {boolean} props.journal Показывать ли кнопку журнала сборки.
 * @param {boolean} props.project Показывать ли кнопку проекта.
 * @param {Locale} props.locale Язык страницы.
 * @param {string} props.path Путь страницы без языка.
 * @param {JSX.Element} [props.account] Вход через GitHub.
 * @returns {JSX.Element} Боковое меню.
 */
export function Sidebar(props: Props): JSX.Element {
  return (
    <nav class={styles.sidebar} aria-label={UI_TEXT.menu.label[props.locale]}>
      <a
        class={styles.logo}
        href={localizedPath(props.locale, "/")}
        aria-label={UI_TEXT.menu.home[props.locale](site.name[props.locale])}
      >
        <PixelPlaque class={styles.logoFull} lines={LOGO_LINES[props.locale]} />
        <PixelPlaque class={styles.logoShort} lines={LOGO_SHORT_LINES[props.locale]} />
      </a>
      <ul class={styles.menu}>
        <li>
          <ButtonLink href={localizedPath(props.locale, "/")} layout="tile">
            <Factory stroke-width={ICON_STROKE} />
            {UI_TEXT.menu.floor[props.locale]}
          </ButtonLink>
        </li>
        <li>
          <Button layout="tile" popovertarget={PANELS.records}>
            <ListVideo stroke-width={ICON_STROKE} />
            {UI_TEXT.menu.records[props.locale]}
          </Button>
        </li>
        <Show when={props.journal}>
          <li>
            <Button layout="tile" popovertarget={PANELS.journal}>
              <MessageSquareText stroke-width={ICON_STROKE} />
              {UI_TEXT.menu.journal[props.locale]}
            </Button>
          </li>
        </Show>
        <Show when={props.project}>
          <li>
            <Button layout="tile" popovertarget={PANELS.project}>
              <FolderKanban stroke-width={ICON_STROKE} />
              {UI_TEXT.menu.project[props.locale]}
            </Button>
          </li>
        </Show>
        <li>
          <Button layout="tile" popovertarget={PANELS.guides}>
            <BookOpen stroke-width={ICON_STROKE} />
            {UI_TEXT.menu.guides[props.locale]}
          </Button>
        </li>
        <li>
          <Button layout="tile" popovertarget={PANELS.about}>
            <Info stroke-width={ICON_STROKE} />
            {UI_TEXT.menu.about[props.locale]}
          </Button>
        </li>
      </ul>
      <div class={styles.footer}>
        <div class={styles.account}>{props.account}</div>
        <div class={styles.bottom}>
          <ButtonLink
            class={styles.bottomTile}
            href={site.repoUrl}
            layout="halfTile"
            variant="ghost"
          >
            <GithubMark />
            {UI_TEXT.menu.code[props.locale]}
          </ButtonLink>
          <For each={otherLocales(props.locale)}>
            {(other) => (
              <ButtonLink
                class={cx(styles.bottomTile, styles.language)}
                href={localizedPath(other, props.path)}
                hreflang={other}
                lang={other}
                aria-label={UI_TEXT.menu.language[props.locale](
                  other.toUpperCase(),
                  LOCALE_NAMES[other],
                )}
                title={LOCALE_NAMES[other]}
                layout="halfTile"
                variant="ghost"
              >
                <Languages stroke-width={ICON_STROKE} />
                {other.toUpperCase()}
              </ButtonLink>
            )}
          </For>
        </div>
      </div>
    </nav>
  );
}
