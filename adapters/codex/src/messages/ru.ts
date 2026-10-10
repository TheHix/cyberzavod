// Russian texts of the Codex adapter.

import type { CodexMessages } from "./codex-messages.ts";

/** Adapter texts in Russian. */
export const ru: CodexMessages = {
  errors: {
    unsupportedAgent: ({ stage, requested, supported }) =>
      `этап ${stage}: ${requested} не поддерживается адаптером Codex, он ведёт только ${supported}`,
    configNotParsed: ({ file, reason }) =>
      `${file} не разобран как TOML: ${reason}. В него ничего не записано: исправьте файл или доверьте проект и одобрите его хуки в самом Codex`,
    configLayoutUnsupported: ({ file, lines }) =>
      `${file} описывает проекты или доверие к хукам в виде, который нельзя безопасно править (встроенная таблица или составной ключ). В него ничего не записано: допишите эти строки сами:\n${lines}`,
    configEditRejected: (file) =>
      `правка ${file} изменила бы не только записи о доверии, поэтому ничего не записано: допишите записи сами или доверьте проект в Codex`,
  },
};
