import type { JSX } from "solid-js";
import { CopyButton, type CopyLabels } from "../copy-button/CopyButton.tsx";
import { codeBlockClass, Prose } from "../prose/Prose.tsx";

interface Props {
  /** Строка кода: команда или Markdown, который читатель вставит к себе. */
  code: string;
  /** Подписи кнопки «копировать» по состояниям на языке страницы: kit словаря не знает. */
  labels: CopyLabels;
}

/**
 * Блок кода ui-kit с кнопкой «копировать» рядом: команда для терминала, строка для README.
 * @param {Props} props Свойства компонента.
 * @param {string} props.code Строка кода.
 * @param {CopyLabels} props.labels Подписи кнопки по состояниям.
 * @returns {JSX.Element} Блок кода с кнопкой.
 */
export function CopyableCode(props: Props): JSX.Element {
  return (
    <Prose>
      <div class={codeBlockClass()}>
        <pre>
          <code>{props.code}</code>
        </pre>
        <div>
          <CopyButton text={() => props.code} labels={props.labels} />
        </div>
      </div>
    </Prose>
  );
}
