import { createSignal, Match, onMount, Switch, type JSX } from "solid-js";
import { avatarUrl, cabinetUrl, pathWithoutSignInResult, signInUrl } from "@/entities/account";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { Avatar, ButtonLink, GithubMark } from "@/shared/ui";
import { $account, loadAccount } from "../model/account.ts";
import styles from "./AccountLink.module.css";

interface Props {
  /** Язык страницы: на нём подписи. */
  locale: Locale;
  /** Раскладка кнопки: плитка в меню или кнопка с текстом в панели записей. */
  layout: "tile" | "text";
}

/**
 * Вход на сайт: гостю — «Войти через GitHub» (в плитке меню — короче, «Войти») с возвратом на эту
 * же страницу, автору — его аватар
 * и логин со ссылкой в личный кабинет. Пока неизвестно, кто смотрит, ничего не показывает, чтобы
 * вошедший автор не видел мелькания кнопки входа; если узнать не удалось, показывает вход.
 * @param {Props} props Свойства компонента.
 * @param {Locale} props.locale Язык страницы.
 * @param {"tile" | "text"} props.layout Раскладка кнопки.
 * @returns {JSX.Element} Ссылка на вход или в кабинет.
 */
export function AccountLink(props: Props): JSX.Element {
  const account = useStoreValue($account);
  // Путь возврата известен только в браузере: страница собрана заранее и параметров не знает.
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
