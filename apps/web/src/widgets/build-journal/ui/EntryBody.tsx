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
  /** Recording language: texts are not translated and carry their own `lang`. */
  language: string;
  /** Page language: the "more" hint is in it. */
  locale: Locale;
}

type SpokenEvent = Pick<InterventionEvent | MessageEvent, "line" | "text">;

interface PromptProps {
  prompt: PromptEvent;
  language: string;
  locale: Locale;
}

// A prompt looks like a message to the model that received it: the main instruction is visible at
// once, the details expand without JS via <details>.
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

// An intervention and a message look the same: the line from the floor and the full text.
function spokenOf(entry: TimelineEntry): SpokenEvent | undefined {
  switch (entry.kind) {
    case "prompt":
      return undefined;
    case "intervention":
      return entry.intervention;
    case "message":
      return entry.message;
    default:
      // A new kind of journal entry will not compile until it is decided here how it looks.
      return entry satisfies never;
  }
}

function promptOf(entry: TimelineEntry): PromptEvent | undefined {
  return entry.kind === "prompt" ? entry.prompt : undefined;
}

/**
 * Journal entry body: a prompt with expandable details, or an intervention or message as the line
 * from the floor and the full text. Has no state of its own: on the recording page it is static
 * markup in the slot of the `JournalEntry` island.
 * @param {Props} props Component props.
 * @param {TimelineEntry} props.entry Journal entry.
 * @param {string} props.language Recording language.
 * @param {Locale} props.locale Page language.
 * @returns {JSX.Element} Entry body.
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
