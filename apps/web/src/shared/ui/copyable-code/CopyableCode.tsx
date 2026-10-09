import type { JSX } from "solid-js";
import { CopyButton, type CopyLabels } from "../copy-button/CopyButton.tsx";
import { codeBlockClass, Prose } from "../prose/Prose.tsx";

interface Props {
  /** A line of code: a command or Markdown the reader pastes into their own project. */
  code: string;
  /** Copy button labels per state in the page language: the kit does not know the dictionary. */
  labels: CopyLabels;
}

/**
 * ui-kit code block with a copy button beside it: a terminal command, a line for a README.
 * @param {Props} props Component props.
 * @param {string} props.code Line of code.
 * @param {CopyLabels} props.labels Button labels per state.
 * @returns {JSX.Element} Code block with a button.
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
