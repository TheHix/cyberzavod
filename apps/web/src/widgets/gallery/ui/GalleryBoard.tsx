import { Match, onMount, Show, Switch, type JSX } from "solid-js";
import { fetchGalleries, fetchGallery, galleriesUrl } from "@/entities/gallery";
import { statsUrl } from "@/entities/stats";
import { readyValue } from "@/shared/api/remote.ts";
import { remoteNoticeOf } from "@/shared/api/remote-notice.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { ButtonLink, Title } from "@/shared/ui";
import { createGalleryPageModel, type GalleryPage } from "../model/gallery-page.ts";
import { AuthorGallery } from "./AuthorGallery.tsx";
import { GalleryList } from "./GalleryList.tsx";
import styles from "./GalleryBoard.module.css";

interface Props {
  /** Язык страницы. */
  locale: Locale;
  /** Адрес сайта — `site` из конфига Astro: для строки бейджа в README. */
  siteUrl: string;
  /**
   * Примеры — проекты, которые цех собрал с нуля: статичная разметка, которую ставит Astro, над
   * галереями пользователей в общем списке. В галерее автора их нет.
   */
  examples?: JSX.Element;
}

type ListPage = Extract<GalleryPage, { view: "list" }>;
type AuthorPage = Extract<GalleryPage, { view: "author" }>;

interface ListViewProps {
  page: ListPage;
  examples: JSX.Element;
  locale: Locale;
}

function ListView(props: ListViewProps): JSX.Element {
  return (
    <>
      <Title as="h1" size="xl">
        {UI_TEXT.gallery.listHeading[props.locale]}
      </Title>
      <p class={styles.note}>{UI_TEXT.gallery.listIntro[props.locale]}</p>
      {props.examples}
      <Title as="h2">{UI_TEXT.examples.userGalleriesHeading[props.locale]}</Title>
      <Show
        when={readyValue(props.page.galleries)}
        fallback={
          <p class={styles.note}>
            {remoteNoticeOf(props.page.galleries, UI_TEXT.remote.failed, props.locale)}
          </p>
        }
      >
        {(galleries) => <GalleryList galleries={galleries()} locale={props.locale} />}
      </Show>
      <div class={styles.links}>
        <ButtonLink href={statsUrl(props.locale)}>
          {UI_TEXT.pages.statsTitle[props.locale]}
        </ButtonLink>
      </div>
    </>
  );
}

function AuthorView(props: { page: AuthorPage; siteUrl: string; locale: Locale }): JSX.Element {
  return (
    <>
      <Title as="h1" size="xl">
        {UI_TEXT.gallery.authorHeading[props.locale](props.page.login)}
      </Title>
      <Show
        when={readyValue(props.page.gallery)}
        fallback={
          <p class={styles.note}>
            {remoteNoticeOf(props.page.gallery, UI_TEXT.gallery.missing, props.locale)}
          </p>
        }
      >
        {(gallery) => (
          <AuthorGallery gallery={gallery()} siteUrl={props.siteUrl} locale={props.locale} />
        )}
      </Show>
      <div class={styles.links}>
        <ButtonLink href={galleriesUrl(props.locale)}>
          {UI_TEXT.gallery.allGalleries[props.locale]}
        </ButtonLink>
      </div>
    </>
  );
}

/**
 * Страница галерей: общий список открытых галерей или, с `?user=<login>`, галерея автора с
 * бейджем для README. Данные приходят из API в браузере.
 * @param {Props} props Свойства компонента.
 * @param {Locale} props.locale Язык страницы.
 * @param {string} props.siteUrl Адрес сайта.
 * @param {JSX.Element} [props.examples] Примеры над галереями пользователей.
 * @returns {JSX.Element} Список галерей или галерея автора.
 */
export function GalleryBoard(props: Props): JSX.Element {
  const model = createGalleryPageModel({
    fetchGalleries: () => fetchGalleries(),
    fetchGallery: (login) => fetchGallery(login),
  });
  const page = useStoreValue(model.$page);
  const listPage = () => {
    const current = page();

    return current.view === "list" ? current : undefined;
  };
  const authorPage = () => {
    const current = page();

    return current.view === "author" ? current : undefined;
  };

  onMount(() => void model.open(window.location.search));

  return (
    <div class={styles.board}>
      <Switch>
        <Match when={listPage()}>
          {(list) => <ListView page={list()} examples={props.examples} locale={props.locale} />}
        </Match>
        <Match when={authorPage()}>
          {(author) => <AuthorView page={author()} siteUrl={props.siteUrl} locale={props.locale} />}
        </Match>
      </Switch>
    </div>
  );
}
