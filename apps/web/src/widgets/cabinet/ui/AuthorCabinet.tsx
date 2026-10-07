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
  /** Действия кабинета. */
  model: CabinetModel;
  /** Идёт действие: кнопки выключены. */
  isBusy: boolean;
  /** Последнее действие не удалось. */
  hasFailed: boolean;
  /** Адрес сайта — для строки бейджа. */
  siteUrl: string;
  locale: Locale;
}

function visibilityOf(gallery: OwnGallery): Visibility {
  return gallery.galleryPublic ? "public" : "private";
}

/**
 * Кабинет вошедшего автора: кто вошёл и выход, видимость галереи с бейджем для открытой
 * галереи и записи с удалением.
 * @param {Props} props Свойства компонента.
 * @param {OwnGallery} props.gallery Своя галерея автора.
 * @param {CabinetModel} props.model Действия кабинета.
 * @param {boolean} props.isBusy Идёт ли действие.
 * @param {boolean} props.hasFailed Не удалось ли последнее действие.
 * @param {string} props.siteUrl Адрес сайта.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Кабинет автора.
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
