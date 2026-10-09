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
  /** Page language. */
  locale: Locale;
  /** Site address, `site` from the Astro config: for the badge line in the README. */
  siteUrl: string;
  /**
   * Examples, the projects the factory built from scratch: static markup placed by Astro above
   * user galleries in the shared list. An author's gallery does not have them.
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
 * The galleries page: the shared list of public galleries or, with `?user=<login>`, an author's
 * gallery with a badge for the README. Data comes from the API in the browser.
 * @param {Props} props Component props.
 * @param {Locale} props.locale Page language.
 * @param {string} props.siteUrl Site address.
 * @param {JSX.Element} [props.examples] Examples above user galleries.
 * @returns {JSX.Element} The list of galleries or an author's gallery.
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
