import { Show, type JSX } from "solid-js";
import { avatarUrl } from "@/entities/account";
import { galleryUrl, ReadmeBadge, type OwnGallery } from "@/entities/gallery";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { Avatar, Button, ButtonLink, SegmentedControl, Title } from "@/shared/ui";
import type { CabinetModel } from "../model/cabinet.ts";
import { OwnRecordings } from "./OwnRecordings.tsx";
import styles from "./CabinetBoard.module.css";

type Visibility = "private" | "public";

interface Props {
  gallery: OwnGallery;
  /** Cabinet actions. */
  model: CabinetModel;
  /** An action is running: buttons are disabled. */
  isBusy: boolean;
  /** The last action failed. */
  hasFailed: boolean;
  /** Site address, for the badge line. */
  siteUrl: string;
  locale: Locale;
}

function visibilityOf(gallery: OwnGallery): Visibility {
  return gallery.galleryPublic ? "public" : "private";
}

/**
 * Cabinet of a signed-in author: who is signed in and sign-out, gallery visibility with a badge
 * for a public gallery, and recordings with deletion.
 * @param {Props} props Component props.
 * @param {OwnGallery} props.gallery The author's own gallery.
 * @param {CabinetModel} props.model Cabinet actions.
 * @param {boolean} props.isBusy Whether an action is running.
 * @param {boolean} props.hasFailed Whether the last action failed.
 * @param {string} props.siteUrl Site address.
 * @param {Locale} props.locale Page language.
 * @returns {JSX.Element} Author cabinet.
 */
export function AuthorCabinet(props: Props): JSX.Element {
  const visibilityOptions = () => [
    { value: "private" as const, label: UI_TEXT.cabinet.private[props.locale] },
    { value: "public" as const, label: UI_TEXT.cabinet.public[props.locale] },
  ];
  const visibilityHint = () =>
    props.gallery.galleryPublic
      ? UI_TEXT.cabinet.publicHint[props.locale]
      : UI_TEXT.cabinet.privateHint[props.locale];

  return (
    <>
      <div class={styles.author}>
        <Avatar src={avatarUrl(props.gallery.login)} alt="" size="large" />
        <Title as="p" class={styles.login}>
          {props.gallery.login}
        </Title>
        <Button disabled={props.isBusy} onClick={() => void props.model.signOut()}>
          {UI_TEXT.cabinet.signOut[props.locale]}
        </Button>
      </div>
      <Show when={props.hasFailed}>
        <p class={styles.note} role="alert">
          {UI_TEXT.cabinet.changeFailed[props.locale]}
        </p>
      </Show>
      <section class={styles.section}>
        <Title as="h2">{UI_TEXT.cabinet.galleryHeading[props.locale]}</Title>
        <SegmentedControl
          label={UI_TEXT.cabinet.visibilityLabel[props.locale]}
          options={visibilityOptions()}
          value={visibilityOf(props.gallery)}
          disabled={props.isBusy}
          onChange={(visibility) => void props.model.setGalleryPublic(visibility === "public")}
        />
        <p class={styles.note}>{visibilityHint()}</p>
        <Show when={props.gallery.galleryPublic}>
          <ButtonLink href={galleryUrl(props.gallery.login, props.locale)}>
            {UI_TEXT.cabinet.galleryPage[props.locale]}
          </ButtonLink>
        </Show>
      </section>
      <Show when={props.gallery.galleryPublic}>
        <ReadmeBadge login={props.gallery.login} siteUrl={props.siteUrl} locale={props.locale} />
      </Show>
      <OwnRecordings
        recordings={props.gallery.recordings}
        limit={props.gallery.limit}
        isBusy={props.isBusy}
        locale={props.locale}
        onDelete={(id) => void props.model.deleteRecording(id)}
      />
    </>
  );
}
