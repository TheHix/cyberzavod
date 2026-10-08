// Справка CLI: общий список команд по разделам и справка одной команды.

import { CLI_COMMAND } from "@cyberzavod/adapter-claude";
import { INTERFACE_LANGUAGES } from "@cyberzavod/core";
import {
  COMMAND_NAMES,
  COMMAND_SECTIONS,
  type CliMessages,
  type CommandName,
  type CommandParameter,
  type CommandSection,
} from "./messages/cli-messages.ts";

/** Где команда в справке: раздел списка или `service` — служебная, вне списка. */
export type CommandPlacement = CommandSection | "service";

/** Команда с её местом в справке. */
export interface PlacedCommand {
  section: CommandPlacement;
}

const LIST_INDENT = "  ";
const COLUMN_GAP = "  ";

function columnWidth(names: readonly string[]): number {
  return Math.max(...names.map((name) => name.length));
}

// Строка вида `  <имя>  <описание>`: имя дополнено пробелами до ширины колонки.
function alignedRow({ name, description }: CommandParameter, width: number): string {
  return `${LIST_INDENT}${name.padEnd(width)}${COLUMN_GAP}${description}`;
}

/**
 * Имена команд, которые показывает общая справка: без служебных, в порядке `COMMAND_NAMES`.
 * @param {Readonly<Record<CommandName, PlacedCommand>>} commands Команды с их местом в справке.
 * @returns {CommandName[]} Видимые имена.
 */
export function listedCommandNames(
  commands: Readonly<Record<CommandName, PlacedCommand>>,
): CommandName[] {
  return COMMAND_NAMES.filter((name) => commands[name].section !== "service");
}

/**
 * Общая справка: с чего начать, команды по разделам и как узнать подробности.
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @param {Readonly<Record<CommandName, PlacedCommand>>} commands Команды с их местом в справке.
 * @returns {string} Справка.
 */
export function generalHelp(
  messages: CliMessages,
  commands: Readonly<Record<CommandName, PlacedCommand>>,
): string {
  const listed = listedCommandNames(commands);
  const width = columnWidth(listed);

  const sections = COMMAND_SECTIONS.map((section) => {
    const names = listed.filter((name) => commands[name].section === section);
    const lines = names.map((name) =>
      alignedRow({ name, description: messages.commands[name].summary }, width),
    );

    return [messages.help.sections[section], ...lines].join("\n");
  });
  const languageOption = messages.help.languageOption(INTERFACE_LANGUAGES.join("|"));

  return [
    messages.help.title,
    messages.help.quickStart,
    "",
    sections.join("\n\n"),
    "",
    messages.help.commandHelpHint,
    languageOption,
  ].join("\n");
}

/**
 * Справка одной команды: строка вызова, описание и параметры.
 * @param {CommandName} name Команда.
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {string} Справка команды.
 */
export function commandHelp(name: CommandName, messages: CliMessages): string {
  const { usage, summary, parameters } = messages.commands[name];
  const head = `${CLI_COMMAND} ${usage}\n${summary}`;

  if (parameters.length === 0) return head;

  const width = columnWidth(parameters.map((parameter) => parameter.name));
  const lines = parameters.map((parameter) => alignedRow(parameter, width));

  return `${head}\n\n${messages.help.parametersTitle}\n${lines.join("\n")}`;
}
