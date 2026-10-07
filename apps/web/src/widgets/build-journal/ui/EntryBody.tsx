import { Match, Show, Switch, type JSX } from "solid-js";
import type { InterventionEvent, MessageEvent, PromptEvent } from "@cyberzavod/core";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { cx } from "@/shared/lib/cx.ts";
import { BulletList, buttonClass, Title } from "@/shared/ui";
import type { TimelineEntry } from "../lib/timeline.ts";
import { SpokenText } from "./SpokenText.tsx";
import styles from "./EntryBody.module.css";

interface Props {
  entry: TimelineEntry;
  /** Язык записи: тексты не переводятся и несут свой `lang`. */
  language: string;
  /** Язык страницы: на нём подсказка «подробнее». */
  locale: Locale;
}

type SpokenEvent = Pick<InterventionEvent | MessageEvent, "line" | "text">;

interface PromptProps {
  prompt: PromptEvent;
  language: string;
  locale: Locale;
}

// Промпт — как сообщение модели, которая его получила: главное указание видно сразу, уточнения
// раскрываются без JS через <details>.
function PromptBody(props: PromptProps): JSX.Element {
  const goal = () => (
    <Title as="span" lang={props.language}>
      {props.prompt.goal}
    </Title>
  );

  return (
    <Show
      when={props.prompt.requirements.length > 0}
      fallback={<Title lang={props.language}>{props.prompt.goal}</Title>}
    >
      <details class={styles.details}>
        <summary>
          {goal()}
          <span class={cx(styles.more, buttonClass({ variant: "link" }))}>
            {UI_TEXT.speech.more[props.locale]}
          </span>
        </summary>
        <BulletList items={props.prompt.requirements} lang={props.language} />
      </details>
    </Show>
  );
}

// Вмешательство и реплика выглядят одинаково: строка из цеха и полный текст.
function spokenOf(entry: TimelineEntry): SpokenEvent | undefined {
  switch (entry.kind) {
    case "prompt":
      return undefined;
    case "intervention":
      return entry.intervention;
    case "message":
      return entry.message;
    default:
      // Новый вид записи журнала не скомпилируется, пока здесь не решат, как он выглядит.
      return entry satisfies never;
  }
}

function promptOf(entry: TimelineEntry): PromptEvent | undefined {
  return entry.kind === "prompt" ? entry.prompt : undefined;
}

/**
 * Тело записи журнала: промпт с раскрываемыми уточнениями, вмешательство или реплика — строкой
 * из цеха и полным текстом. Без своего состояния: на странице записи это статичная разметка
 * в слоте острова `JournalEntry`.
 * @param {Props} props Свойства компонента.
 * @param {TimelineEntry} props.entry Запись журнала.
 * @param {string} props.language Язык записи.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Тело записи.
 */
export function EntryBody(props: Props): JSX.Element {
  return (
    <Switch>
      <Match when={promptOf(props.entry)}>
        {(prompt) => (
          <PromptBody prompt={prompt()} language={props.language} locale={props.locale} />
        )}
      </Match>
      <Match when={spokenOf(props.entry)}>
        {(spoken) => (
          <SpokenText line={spoken().line} text={spoken().text} language={props.language} />
        )}
      </Match>
    </Switch>
  );
}
