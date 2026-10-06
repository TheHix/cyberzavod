import { onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import { CopyButton, codeBlockClass } from "@/shared/ui";

interface Props {
  /** id элемента статьи, в блоки кода которого добавляются кнопки. */
  scope: string;
}

// Блок кода получает обёртку и кнопку только в браузере; без JS остаётся прежний `<pre>`.
function addCopyButton(code: HTMLElement, pre: HTMLElement): () => void {
  const block = document.createElement("div");
  block.className = codeBlockClass();
  const buttonSlot = document.createElement("div");
  pre.before(block);
  block.append(pre, buttonSlot);
  const disposeButton = render(
    () => <CopyButton text={() => code.textContent ?? ""} />,
    buttonSlot,
  );

  return () => {
    disposeButton();
    block.before(pre);
    block.remove();
  };
}

/**
 * Остров без своей разметки: после загрузки страницы оборачивает каждый блок кода статьи
 * в обёртку и ставит рядом кнопку «копировать».
 * @param {Props} props Свойства компонента.
 * @param {string} props.scope id элемента статьи.
 * @returns {null} Своей разметки нет.
 * @throws {Error} Если на странице нет элемента статьи с таким id.
 */
export function CopyCode(props: Props): null {
  onMount(() => {
    const article = document.getElementById(props.scope);
    if (article === null) throw new Error(`нет элемента статьи с id ${props.scope}`);

    const removers = Array.from(article.querySelectorAll<HTMLElement>("pre > code")).flatMap(
      (code) => (code.parentElement === null ? [] : [addCopyButton(code, code.parentElement)]),
    );
    onCleanup(() => removers.forEach((remove) => remove()));
  });

  return null;
}
