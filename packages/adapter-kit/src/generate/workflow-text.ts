// Texts built from the harness and the config that every agent's files carry: the working rules of
// the process, the table of stages and the stages the lead runs itself. The agents differ in how
// they call a skill and where the role files lie.

import type { Harness, ProjectConfig, StageGuide, Workflow } from "@cyberzavod/core";

/** What the working rules are built from. */
export interface WorkingRulesSource {
  config: ProjectConfig;
  harness: Harness;
  workflow: Workflow;
  /** How the human calls the workflow skill, with the task: `/feature <task>`. */
  featureCall: string;
  /** Directory of the role files from the project root with `/`, with a trailing `/`. */
  agentsDirectory: string;
}

/**
 * Guides of the workflow stages in order.
 * @param {Harness} harness Harness.
 * @param {Workflow} workflow Workflow the project runs.
 * @returns {StageGuide[]} A guide per workflow stage.
 */
export function stageGuidesOf(harness: Harness, workflow: Workflow): StageGuide[] {
  return workflow.stages.map((stage) => harness.stages[stage]);
}

function verificationText(config: ProjectConfig): string {
  const commands = config.verification.commands.map((command) => `- \`${command}\``);

  if (commands.length === 0) {
    return "Project checks are not set: add them to `verification.commands` in `.cyberzavod/project.json`.";
  }

  return `Project checks (\`verification.commands\` in \`.cyberzavod/project.json\`) must pass before a commit:\n\n${commands.join("\n")}`;
}

/**
 * The working rules of the process as paragraphs: the heading, the route of the workflow, the
 * project checks and the principles of the harness.
 * @param {WorkingRulesSource} source Config, harness, workflow and how the agent calls things.
 * @returns {string[]} Paragraphs without blank lines between them.
 */
export function workingRulesParagraphs(source: WorkingRulesSource): string[] {
  const { config, harness, workflow, featureCall, agentsDirectory } = source;
  const route = stageGuidesOf(harness, workflow)
    .map(({ title }) => title)
    .join(" → ");

  return [
    "# How to work in this project",
    `The development process is run by Cyberzavod (harness ${config.harness}, workflow \`${config.workflow}\`): ${route}. \`${featureCall}\` takes a task through the whole workflow; stage roles are agents in \`${agentsDirectory}\`.`,
    verificationText(config),
    ...harness.principles.map(({ text }) => text),
  ];
}

/**
 * Table of the workflow stages with the role and model of each.
 * @param {readonly StageGuide[]} guides Guides of the workflow stages.
 * @param {(guide: StageGuide) => string} modelOf Model of a stage with a role.
 * @returns {string} Markdown table.
 */
export function stageTable(
  guides: readonly StageGuide[],
  modelOf: (guide: StageGuide) => string,
): string {
  const rows = guides.map((guide) =>
    guide.role === undefined
      ? `| ${guide.title} | the lead itself | — |`
      : `| ${guide.title} | \`${guide.role.name}\` | ${modelOf(guide)} |`,
  );

  return ["| Stage | Role | Model |", "| --- | --- | --- |", ...rows].join("\n");
}

/**
 * Sections for the stages the lead runs itself: they have no role.
 * @param {readonly StageGuide[]} guides Guides of the workflow stages.
 * @returns {string[]} A `## <title> stage` section per stage without a role.
 */
export function ownStageSections(guides: readonly StageGuide[]): string[] {
  return guides
    .filter((guide) => guide.role === undefined)
    .map((guide) => `## ${guide.title} stage\n\n${guide.body}`);
}
