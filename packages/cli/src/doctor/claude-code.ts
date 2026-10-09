// Проверка Claude Code: сейчас это единственный агент, которого Cyberzavod ведёт полностью.
// Программы `claude` может не быть и при рабочей установке — у десктопного приложения и
// расширения IDE, поэтому её отсутствие — заметка, а не ошибка.

import { notice, passed, type MachineCheck } from "./check.ts";

const CLAUDE_PROGRAM = "claude";

/** Программа `claude` найдена в `PATH`. */
export const claudeCodeCheck: MachineCheck = {
  id: "claude-code",
  run: async (machine, messages) => {
    const { claudeCode } = messages.doctor;
    const isInstalled = await machine.isProgramAvailable(CLAUDE_PROGRAM);

    if (isInstalled) return passed(claudeCode.passed);

    return notice({ summary: claudeCode.missing, hint: claudeCode.install });
  },
};
