// `cyberzavod doctor`: проверяет по пунктам машину, подключение проекта и файлы агента и под
// каждой ошибкой говорит, как её чинить. Ничего не исправляет и не ходит в сеть.

import type { ClaudeMessages } from "@cyberzavod/adapter-claude";
import type {
  CheckResult,
  Machine,
  MachineCheck,
  ProjectCheck,
  ProjectContext,
} from "../doctor/check.ts";
import { claudeCodeCheck } from "../doctor/claude-code.ts";
import { configCheck } from "../doctor/config.ts";
import { freshnessCheck } from "../doctor/freshness.ts";
import { galleryCheck } from "../doctor/gallery.ts";
import { gitCheck } from "../doctor/git.ts";
import { gitignoreCheck } from "../doctor/gitignore.ts";
import { hooksCheck } from "../doctor/hooks.ts";
import { nodeCheck } from "../doctor/node.ts";
import { rulesCheck } from "../doctor/rules.ts";
import type { Installation } from "../installation/installation.ts";
import { printJson } from "../json-output.ts";
import type { CliMessages } from "../messages/cli-messages.ts";

const PASSED_SIGN = "✓";
const FAILED_SIGN = "✗";
const NOTICE_SIGN = "–";
const HINT_INDENT = "    ";

/** Проверки машины в порядке показа: идут до проверок проекта и не зависят от него. */
const MACHINE_CHECKS: readonly MachineCheck[] = [
  nodeCheck,
  gitCheck,
  claudeCodeCheck,
  galleryCheck,
];
const CONFIG_CHECK_ID = "config";

/** Что нужно проверкам проекта от внешнего мира: поиск программ и запуск команд. */
export type ProjectTools = Pick<ProjectContext, "isProgramAvailable" | "runCommand">;

/** Что нужно `doctor`: машина, проверки проекта, версия CLI, тексты и работа с программами. */
export interface DoctorOptions {
  machine: Machine;
  /** Проверки проекта в порядке показа; идут, только если проект найден. */
  projectChecks: readonly ProjectCheck[];
  /** Поиск программ и запуск команд для проверок проекта. */
  projectTools: ProjectTools;
  installation: Installation;
  messages: CliMessages;
  claudeMessages: ClaudeMessages;
  /** Напечатать итог одним JSON-документом, а не строками для человека. */
  isJson: boolean;
}

/** Результат проверки с её кодом. */
interface IdentifiedResult {
  id: string;
  result: CheckResult;
}

/**
 * Проверки проекта в порядке показа; проверка команд — та, что выбрал вызывающий: найти программы
 * или запустить команды.
 * @param {ProjectCheck} commandsCheck Проверка команд проверок проекта.
 * @returns {ProjectCheck[]} Хуки, файлы агента, правила, команды и `.gitignore`.
 */
export function projectChecksWith(commandsCheck: ProjectCheck): ProjectCheck[] {
  return [hooksCheck, freshnessCheck, rulesCheck, commandsCheck, gitignoreCheck];
}

function linesOf(result: CheckResult, messages: CliMessages): string[] {
  switch (result.status) {
    case "passed":
      return [`${PASSED_SIGN} ${result.summary}`];
    case "failed":
      return [
        `${FAILED_SIGN} ${result.problem}`,
        `${HINT_INDENT}${messages.doctor.fix(result.fix)}`,
      ];
    case "notice":
      return [
        `${NOTICE_SIGN} ${result.summary}`,
        `${HINT_INDENT}${messages.doctor.hint(result.hint)}`,
      ];
  }
}

function isProblem(result: CheckResult): boolean {
  switch (result.status) {
    case "passed":
    case "notice":
      return false;
    case "failed":
      return true;
  }
}

// Результаты по одному, в порядке показа: долгие проверки не держат уже готовые пункты.
async function* resultsOf(
  directory: string,
  options: DoctorOptions,
): AsyncGenerator<IdentifiedResult> {
  const { machine, messages, installation, claudeMessages, projectTools } = options;

  for (const check of MACHINE_CHECKS) {
    yield { id: check.id, result: await check.run(machine, messages) };
  }

  const { result, project } = await configCheck(directory, messages);

  yield { id: CONFIG_CHECK_ID, result };

  if (project === undefined) return;

  const context: ProjectContext = {
    project,
    installation,
    messages,
    claudeMessages,
    ...projectTools,
  };

  for (const check of options.projectChecks) {
    yield { id: check.id, result: await check.run(context) };
  }
}

function jsonOf({ id, result }: IdentifiedResult) {
  switch (result.status) {
    case "passed":
      return { id, status: result.status, message: result.summary };
    case "failed":
      return { id, status: result.status, message: result.problem, fix: result.fix };
    case "notice":
      return { id, status: result.status, message: result.summary, hint: result.hint };
  }
}

/**
 * Проверяет машину, подключение проекта и файлы агента и печатает строку на пункт: ✓, ✗ или –,
 * а под ✗ — как починить; с `isJson` — один JSON-документ. Вне проекта печатает проверки машины
 * и ошибку конфига.
 * @param {string} directory Каталог, из которого запущена команда.
 * @param {DoctorOptions} options Машина, проверки проекта, поиск программ и запуск команд
 *   (`projectTools`), версия CLI, тексты, вид вывода.
 * @returns {Promise<boolean>} true, если ни одна проверка не провалилась.
 */
export async function runDoctor(directory: string, options: DoctorOptions): Promise<boolean> {
  const { messages, isJson } = options;
  const results: IdentifiedResult[] = [];

  for await (const identified of resultsOf(directory, options)) {
    results.push(identified);

    if (!isJson) console.log(linesOf(identified.result, messages).join("\n"));
  }

  const problemCount = results.filter(({ result }) => isProblem(result)).length;

  if (isJson) {
    const status = problemCount === 0 ? "ok" : "problems";

    printJson("doctor", { status, problems: problemCount, checks: results.map(jsonOf) });
  } else {
    console.log(
      problemCount === 0 ? messages.doctor.allPassed : messages.doctor.problems(problemCount),
    );
  }

  return problemCount === 0;
}
