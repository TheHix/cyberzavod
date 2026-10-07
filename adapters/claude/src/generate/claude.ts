// Что адаптер знает о Claude Code: какие агенты и модели он ведёт, какую модель берёт по
// умолчанию для каждого этапа и какие инструменты даёт роли по её доступу.

import { DEFAULT_MODEL, type AgentConfig, type Stage, type StageAccess } from "@cyberzavod/core";

/** Провайдер моделей Claude. */
export const CLAUDE_PROVIDER = "anthropic";

/** Агент, которого ведёт этот адаптер. */
export const CLAUDE_AGENT = "claude";

// Постановка и ревью — дороже всего ошибиться, поэтому сильная модель; код и проверки — быстрая.
const DEFAULT_MODELS: Readonly<Record<Stage, string>> = {
  planning: "opus",
  implementation: "sonnet",
  review: "opus",
  verification: "sonnet",
  record: "sonnet",
};

const STAGE_EFFORT: Readonly<Record<Stage, string>> = {
  planning: "high",
  implementation: "high",
  review: "high",
  verification: "medium",
  record: "medium",
};

/** Модель исполнителя на второй доработке: прежняя уже не справилась дважды. */
export const ESCALATION_MODEL = "opus";

const ROLE_TOOLS: Readonly<Record<StageAccess, string>> = {
  read: "Read, Grep, Glob, Bash",
  write: "Read, Edit, Write, Grep, Glob, Bash",
};

/** Ошибка генерации файлов Claude Code: конфиг просит то, чего адаптер не умеет. */
export class GenerateError extends Error {}

/**
 * Модель Claude для этапа.
 * @param {Stage} stage Этап.
 * @param {AgentConfig | undefined} agent Агент этапа из конфига проекта.
 * @returns {string} Модель из конфига или модель адаптера по умолчанию для этапа.
 * @throws {GenerateError} Если этап отдан другому провайдеру или агенту.
 */
export function claudeModelOf(stage: Stage, agent: AgentConfig | undefined): string {
  const {
    provider = CLAUDE_PROVIDER,
    agent: name = CLAUDE_AGENT,
    model = DEFAULT_MODEL,
  } = agent ?? {};
  if (provider !== CLAUDE_PROVIDER || name !== CLAUDE_AGENT) {
    throw new GenerateError(
      `этап ${stage}: ${provider}/${name} не поддерживается, пока есть только адаптер ` +
        `${CLAUDE_PROVIDER}/${CLAUDE_AGENT}`,
    );
  }
  return model === DEFAULT_MODEL ? DEFAULT_MODELS[stage] : model;
}

/**
 * Усилие рассуждения Claude для роли этапа.
 * @param {Stage} stage Этап.
 * @returns {string} Значение `effort` для шапки агента.
 */
export function claudeEffortOf(stage: Stage): string {
  return STAGE_EFFORT[stage];
}

/**
 * Инструменты Claude Code для роли с данным доступом.
 * @param {StageAccess} access Доступ роли к файлам.
 * @returns {string} Значение `tools` для шапки агента.
 */
export function claudeToolsOf(access: StageAccess): string {
  return ROLE_TOOLS[access];
}
