// Кто выполняет этап: провайдер, агент и модель. Ядро не знает ни одного провайдера —
// какие сочетания работают, решает адаптер агента.

import { isLine, isObject } from "./guards.ts";

/**
 * Агент этапа. Любое поле может отсутствовать: тогда адаптер берёт своё значение по умолчанию.
 * Модель `default` значит то же, что её отсутствие.
 */
export interface AgentConfig {
  /** Провайдер модели, например `anthropic`. */
  provider?: string;
  /** Агент, который ведёт работу, например `claude`; по нему выбирается адаптер. */
  agent?: string;
  /** Модель или `default`. */
  model?: string;
}

/** Модель по выбору адаптера: для каждого этапа своя. */
export const DEFAULT_MODEL = "default";

/** Ошибка описания агента: оно пришло извне и не прошло проверку. */
export class AgentConfigError extends Error {}

const AGENT_FIELDS = ["provider", "agent", "model"] as const;

/**
 * Проверяет описание агента этапа.
 * @param {unknown} raw Разобранный JSON агента.
 * @returns {AgentConfig} Проверенное описание; отсутствующих полей нет и в результате.
 * @throws {AgentConfigError} Если описание не объект или поле не строка в одну строку.
 */
export function parseAgentConfig(raw: unknown): AgentConfig {
  if (!isObject(raw)) throw new AgentConfigError("agent must be an object");

  const config: AgentConfig = {};

  for (const field of AGENT_FIELDS) {
    const value = raw[field];

    if (value === undefined) continue;
    if (!isLine(value)) throw new AgentConfigError(`${field} must be a non-empty string`);

    config[field] = value;
  }

  return config;
}
