import { Match, onMount, Switch, type JSX } from "solid-js";
import { signOut } from "@/entities/account";
import { deleteOwnRecording, setGalleryPublic } from "@/entities/gallery";
import {
  $account,
  AccountLink,
  loadAccount,
  reloadAccount,
  type Account,
  type UnknownAccount,
} from "@/features/sign-in";
import { remoteNoticeOf } from "@/shared/api/remote-notice.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useHydratedStoreValue, useStoreValue } from "@/shared/lib/use-store-value.ts";
import { Title } from "@/shared/ui";
import { createCabinetModel } from "../model/cabinet.ts";
import { AuthorCabinet } from "./AuthorCabinet.tsx";
import { CliHint } from "./CliHint.tsx";
import styles from "./CabinetBoard.module.css";

/** The page is built with nobody known to be signed in: the markup has the loading state. */
const BUILT_ACCOUNT: Account = { status: "loading" };

interface Props {
  /** Page language. */
  locale: Locale;
  /** Site address, `site` from the Astro config: for the badge line in the README. */
  siteUrl: string;
}

/**
 * Personal cabinet: for a guest, an explanation and GitHub sign-in; for an author, their gallery
 * and recordings. The cabinet learns who is signed in from the store shared with the menu; data
 * comes from the API in the browser.
 * @param {Props} props Component props.
 * @param {Locale} props.locale Page language.
 * @param {string} props.siteUrl Site address.
 * @returns {JSX.Element} Cabinet.
 */
export function CabinetBoard(props: Props): JSX.Element {
  const model = createCabinetModel({
    setGalleryPublic: (isPublic) => setGalleryPublic(isPublic),
    deleteRecording: (id) => deleteOwnRecording(id),
    signOut: () => signOut(),
    reloadAccount,
  });
  // The menu island may learn who is signed in before this larger island loads.
  const account = useHydratedStoreValue($account, BUILT_ACCOUNT);
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
