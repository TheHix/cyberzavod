import { Match, onMount, Switch, type JSX } from "solid-js";
import { signOut } from "@/entities/account";
import { deleteOwnRecording, setGalleryPublic } from "@/entities/gallery";
import {
  $account,
  AccountLink,
  loadAccount,
  reloadAccount,
  type UnknownAccount,
} from "@/features/sign-in";
import { remoteNoticeOf } from "@/shared/api/remote-notice.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { Title } from "@/shared/ui";
import { createCabinetModel } from "../model/cabinet.ts";
import { AuthorCabinet } from "./AuthorCabinet.tsx";
import { CliHint } from "./CliHint.tsx";
import styles from "./CabinetBoard.module.css";

interface Props {
  /** Язык страницы. */
  locale: Locale;
  /** Адрес сайта — `site` из конфига Astro: для строки бейджа в README. */
  siteUrl: string;
}

/**
 * Личный кабинет: гостю — объяснение и вход через GitHub, автору — его галерея и записи. Кто
 * вошёл, кабинет узнаёт из общего с меню стора; данные приходят из API в браузере.
 * @param {Props} props Свойства компонента.
 * @param {Locale} props.locale Язык страницы.
 * @param {string} props.siteUrl Адрес сайта.
 * @returns {JSX.Element} Кабинет.
 */
export function CabinetBoard(props: Props): JSX.Element {
  const model = createCabinetModel({
    setGalleryPublic: (isPublic) => setGalleryPublic(isPublic),
    deleteRecording: (id) => deleteOwnRecording(id),
    signOut: () => signOut(),
    reloadAccount,
  });
  const account = useStoreValue($account);
  const isBusy = useStoreValue(model.$isBusy);
  const hasFailed = useStoreValue(model.$hasFailed);
  const authorGallery = () => {
    const current = account();

    return current.status === "author" ? current.gallery : undefined;
  };
  const isGuest = () => account().status === "guest";
  const unknownAccount = (): UnknownAccount | undefined => {
    const current = account();
    const isUnknown = current.status !== "author" && current.status !== "guest";

    return isUnknown ? current : undefined;
  };

  onMount(() => void loadAccount());

  return (
    <div class={styles.board}>
      <Title as="h1" size="xl">
        {UI_TEXT.cabinet.heading[props.locale]}
      </Title>
      <Switch>
        <Match when={authorGallery()}>
          {(gallery) => (
            <AuthorCabinet
              gallery={gallery()}
              model={model}
              isBusy={isBusy()}
              hasFailed={hasFailed()}
              siteUrl={props.siteUrl}
              locale={props.locale}
            />
          )}
        </Match>
        <Match when={isGuest()}>
          <section class={styles.section}>
            <p class={styles.note}>{UI_TEXT.cabinet.guestIntro[props.locale]}</p>
            <AccountLink locale={props.locale} layout="text" />
          </section>
        </Match>
        <Match when={unknownAccount()}>
          {(state) => (
            <p class={styles.note}>
              {remoteNoticeOf(state(), UI_TEXT.remote.failed, props.locale)}
            </p>
          )}
        </Match>
      </Switch>
      <CliHint locale={props.locale} />
    </div>
  );
}
