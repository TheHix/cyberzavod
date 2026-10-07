import { onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { CopyButton, codeBlockClass } from "@/shared/ui";

interface Props {
  /** id элемента статьи, в блоки кода которого добавляются кнопки. */
  scope: string;
  /** Язык страницы: на нём подписана кнопка. */
  locale: Locale;
}

// Блок кода получает обёртку и кнопку только в браузере; без JS остаётся прежний `<pre>`.
function addCopyButton(code: HTMLElement, pre: HTMLElement, locale: Locale): () => void {
  const block = document.createElement("div");
  const buttonSlot = document.createElement("div");

  block.className = codeBlockClass();
  // Статья может быть в оригинале на другом языке: кнопка подписана на языке страницы.
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
 * Остров без своей разметки: после загрузки страницы оборачивает каждый блок кода статьи
 * в обёртку и ставит рядом кнопку «копировать».
 * @param {Props} props Свойства компонента.
 * @param {string} props.scope id элемента статьи.
 * @param {Locale} props.locale Язык страницы для подписей кнопок.
 * @returns {null} Своей разметки нет.
 * @throws {Error} Если на странице нет элемента статьи с таким id.
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
