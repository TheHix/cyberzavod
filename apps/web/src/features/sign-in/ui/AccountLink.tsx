import { createSignal, Match, onMount, Switch, type JSX } from "solid-js";
import { avatarUrl, cabinetUrl, pathWithoutSignInResult, signInUrl } from "@/entities/account";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { Avatar, ButtonLink, GithubMark } from "@/shared/ui";
import { $account, loadAccount } from "../model/account.ts";
import styles from "./AccountLink.module.css";

interface Props {
  /** Page language: labels are in it. */
  locale: Locale;
  /** Button layout: a tile in the menu or a text button in the recordings panel. */
  layout: "tile" | "text";
}

/**
 * Site sign-in: a guest sees "Sign in with GitHub" (shorter in the menu tile, "Sign in") returning
 * to this same page, an author sees their avatar
 * and login linking to the account page. While it is unknown who is viewing, shows nothing, so a
 * signed-in author does not see the sign-in button flash; if that cannot be found out, shows
 * sign-in.
 * @param {Props} props Component props.
 * @param {Locale} props.locale Page language.
 * @param {"tile" | "text"} props.layout Button layout.
 * @returns {JSX.Element} A link to sign in or to the account page.
 */
export function AccountLink(props: Props): JSX.Element {
  const account = useStoreValue($account);
  // The return path is known only in the browser: the page is built ahead of time and does not
  // know the parameters.
  const [returnPath, setReturnPath] = createSignal("/");
  const author = () => {
    const current = account();

    return current.status === "author" ? current.gallery : undefined;
  };
  const isKnown = () => account().status !== "loading";
  const signInLabel = () =>
    props.layout === "tile"
      ? UI_TEXT.account.signInShort[props.locale]
      : UI_TEXT.account.signIn[props.locale];

  onMount(() => {
    setReturnPath(pathWithoutSignInResult(window.location.pathname, window.location.search));
    void loadAccount();
  });

  return (
    <Switch>
      <Match when={author()}>
        {(gallery) => (
          <ButtonLink
            href={cabinetUrl(props.locale)}
            layout={props.layout}
            aria-label={UI_TEXT.account.cabinetLabel[props.locale](gallery().login)}
          >
            <Avatar src={avatarUrl(gallery().login)} alt="" />
            <span class={styles.login}>{gallery().login}</span>
          </ButtonLink>
        )}
      </Match>
      <Match when={isKnown()}>
        <ButtonLink
          href={signInUrl(returnPath())}
          layout={props.layout}
          variant="primary"
          aria-label={UI_TEXT.account.signIn[props.locale]}
          title={UI_TEXT.account.signIn[props.locale]}
        >
          <GithubMark />
          {signInLabel()}
        </ButtonLink>
      </Match>
    </Switch>
  );
}
