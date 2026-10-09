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
  /** Whether the page has a build journal; then the menu has its button. */
  journal: boolean;
  /** Whether the page has a project card; then the menu has a "Project" button. */
  project: boolean;
  /** Page language: menu captions are in it. */
  locale: Locale;
  /**
   * Page path without the language: by it the switch leads to the same page in another language.
   */
  path: string;
  /**
   * GitHub sign-in is an island placed by the page: the menu renders without JS. On a narrow and
   * short screen it is absent, being in the recordings panel.
   */
  account?: JSX.Element;
}

const ICON_STROKE = 2.5;

/**
 * The site menu on the left: the logo, the floor, the recordings, build journal, project, guides
 * and "about" panels, GitHub sign-in, the code link and the language switch.
 * Works without JavaScript: panels open with native popover.
 * @param {Props} props Component props.
 * @param {boolean} props.journal Whether to show the build journal button.
 * @param {boolean} props.project Whether to show the project button.
 * @param {Locale} props.locale Page language.
 * @param {string} props.path Page path without the language.
 * @param {JSX.Element} [props.account] GitHub sign-in.
 * @returns {JSX.Element} Side menu.
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
