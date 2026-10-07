import X from "lucide-solid/icons/x";
import { createSignal, onMount, Show, type JSX } from "solid-js";
import { isSignInFailed, pathWithoutSignInResult } from "@/entities/account";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { Button, Card } from "@/shared/ui";
import styles from "./SignInFailedNotice.module.css";

interface Props {
  /** Язык страницы: на нём сообщение. */
  locale: Locale;
}

const ICON_STROKE = 3;

/**
 * Сообщение о неудачном входе: API возвращает на сайт с `?login=failed`. Отметка сразу уходит из
 * адреса, чтобы не вернуться после обновления страницы и не попасть в путь возврата.
 * @param {Props} props Свойства компонента.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Сообщение с кнопкой «закрыть» или ничего.
 */
export function SignInFailedNotice(props: Props): JSX.Element {
  const [isShown, setShown] = createSignal(false);

  onMount(() => {
    const { pathname, search } = window.location;

    if (!isSignInFailed(search)) return;

    window.history.replaceState(
      window.history.state,
      "",
      pathWithoutSignInResult(pathname, search),
    );
    setShown(true);
  });

  return (
    <Show when={isShown()}>
      <div class={styles.notice} role="alert">
        <Card>
          <div class={styles.body}>
            <p class={styles.text}>{UI_TEXT.account.signInFailed[props.locale]}</p>
            <Button
              layout="icon"
              aria-label={UI_TEXT.panels.close[props.locale]}
              onClick={() => setShown(false)}
            >
              <X stroke-width={ICON_STROKE} />
            </Button>
          </div>
        </Card>
      </div>
    </Show>
  );
}
