import { onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { CopyButton, codeBlockClass } from "@/shared/ui";

interface Props {
  /** Id of the article element whose code blocks get buttons. */
  scope: string;
  /** Page language: the button is labeled in it. */
  locale: Locale;
}

// A code block gets the wrapper and button only in the browser; without JS the plain `<pre>` stays.
function addCopyButton(code: HTMLElement, pre: HTMLElement, locale: Locale): () => void {
  const block = document.createElement("div");
  const buttonSlot = document.createElement("div");

  block.className = codeBlockClass();
  // The article may originally be in another language: the button is labeled in the page language.
  buttonSlot.lang = locale;
  pre.before(block);
  block.append(pre, buttonSlot);

  const disposeButton = render(
    () => <CopyButton text={() => code.textContent ?? ""} labels={UI_TEXT.copy.labels[locale]} />,
    buttonSlot,
  );

  return () => {
    disposeButton();
    block.before(pre);
    block.remove();
  };
}

function addCopyButtons(article: HTMLElement, locale: Locale): (() => void)[] {
  const removers: (() => void)[] = [];

  for (const code of article.querySelectorAll<HTMLElement>("pre > code")) {
    const pre = code.parentElement;

    if (pre === null) continue;

    removers.push(addCopyButton(code, pre, locale));
  }

  return removers;
}

/**
 * An island without its own markup: after the page loads it wraps every code block of the article
 * in a wrapper and puts a "copy" button next to it.
 * @param {Props} props Component props.
 * @param {string} props.scope Article element id.
 * @param {Locale} props.locale Page language for button labels.
 * @returns {null} No markup of its own.
 * @throws {Error} If the page has no article element with this id.
 */
export function CopyCode(props: Props): null {
  onMount(() => {
    const article = document.getElementById(props.scope);

    if (article === null) throw new Error(`нет элемента статьи с id ${props.scope}`);

    const removers = addCopyButtons(article, props.locale);

    onCleanup(() => removers.forEach((remove) => remove()));
  });

  return null;
}
