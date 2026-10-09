// Harness is the development process in text: principles, stages and the lead. Here is the model
// of these texts and their parsing; where to get the texts (a directory on disk or built into the
// CLI bundle) is decided by other packages.

import { isLine } from "./guards.ts";
import { parseWorkflow, STAGES, type Stage, type Workflow } from "./stage.ts";

/** What a stage role may do: only read, or also change files. */
export const STAGE_ACCESS = ["read", "write"] as const;

/** A stage role's access to the project files. */
export type StageAccess = (typeof STAGE_ACCESS)[number];

/** Stage role: the agent the lead hands work to. */
export interface StageRole {
  /** Role name, for example `analyst`; the adapter names the agent file after it. */
  name: string;
  access: StageAccess;
}

/** Stage description from `harness/stages/<stage>.md`. */
export interface StageGuide {
  stage: Stage;
  /** Stage title for people. */
  title: string;
  /** One line about what the stage does. */
  description: string;
  /** Stage role; a stage the lead runs itself has none. */
  role?: StageRole;
  /** Stage text without the header: instructions for the role or the lead. */
  body: string;
}

/** Principle from `harness/principles/`: the file name without extension, and the text. */
export interface Principle {
  name: string;
  text: string;
}

/** The whole harness: principles, stages, workflows and the lead's rules. */
export interface Harness {
  principles: Principle[];
  stages: Record<Stage, StageGuide>;
  workflows: Workflow[];
  /** How the lead takes a task through the stages. */
  conductor: string;
}

/** Harness error: a stage or workflow file failed validation. */
export class HarnessError extends Error {}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const FRONTMATTER_LINE = /^([a-z]+):\s*(.*)$/;

function frontmatterOf(text: string, stage: Stage): { fields: Map<string, string>; body: string } {
  const match = FRONTMATTER.exec(text);

  if (match === null) throw new HarnessError(`stage ${stage}: no front matter between --- lines`);

  const fields = new Map<string, string>();

  for (const line of (match[1] ?? "").split("\n")) {
    const field = FRONTMATTER_LINE.exec(line);

    if (field === null) {
      throw new HarnessError(`stage ${stage}: front matter line «${line}» is not a field`);
    }

    fields.set(field[1] ?? "", (field[2] ?? "").trim());
  }

  return { fields, body: text.slice(match[0].length).trim() };
}

function isStageAccess(value: unknown): value is StageAccess {
  return (STAGE_ACCESS as readonly unknown[]).includes(value);
}

function roleOf(fields: ReadonlyMap<string, string>, stage: Stage): StageRole | undefined {
  const name = fields.get("role");

  if (name === undefined) return undefined;
  if (!/^[a-z][a-z-]*$/.test(name)) {
    throw new HarnessError(
      `stage ${stage}: role must contain only lowercase Latin letters and «-»`,
    );
  }

  const access = fields.get("access");

  if (!isStageAccess(access)) {
    throw new HarnessError(`stage ${stage}: access must be ${STAGE_ACCESS.join(" or ")}`);
  }

  return { name, access };
}

/**
 * Parses a stage file: a `key: value` header between `---` lines and the text after it.
 * @param {Stage} stage The stage the file belongs to.
 * @param {string} text File contents.
 * @returns {StageGuide} Stage description.
 * @throws {HarnessError} If the header is missing, lacks a title or description, or has a bad role.
 */
export function parseStageGuide(stage: Stage, text: string): StageGuide {
  const { fields, body } = frontmatterOf(text.replace(/\r\n/g, "\n"), stage);
  const title = fields.get("title");
  const description = fields.get("description");

  if (!isLine(title) || !isLine(description)) {
    throw new HarnessError(`stage ${stage}: front matter needs title and description`);
  }

  const role = roleOf(fields, stage);

  return role === undefined
    ? { stage, title, description, body }
    : { stage, title, description, role, body };
}

/**
 * Harness files: path from the harness root with `/` → text. This way the harness arrives the same
 * from a directory on disk and from the CLI bundle where it is built in.
 */
export type HarnessFiles = Readonly<Record<string, string>>;

const MARKDOWN = ".md";
const JSON_EXTENSION = ".json";
const PRINCIPLES = "principles/";
const STAGES_DIRECTORY = "stages/";
const WORKFLOWS = "workflows/";
const CONDUCTOR = "conductor.md";

function requiredFile(files: HarnessFiles, name: string): string {
  const text = files[name];

  if (text === undefined) throw new HarnessError(`harness has no file ${name}`);

  return text;
}

function compareNames(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;

  return 0;
}

// Files directly in the directory, not nested: sorted by name so the texts do not depend on the
// order the disk returned them in.
function filesIn(files: HarnessFiles, directory: string, extension: string): [string, string][] {
  const matching = Object.entries(files).filter(
    ([path]) => path.startsWith(directory) && path.endsWith(extension),
  );
  const named = matching.map(([path, text]): [string, string] => [
    path.slice(directory.length, -extension.length),
    text,
  ]);
  const direct = named.filter(([name]) => !name.includes("/"));

  return direct.sort(([left], [right]) => compareNames(left, right));
}

function workflowFrom(name: string, text: string): Workflow {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new HarnessError(`workflow ${name}: not JSON`, { cause: err });
  }

  const workflow = parseWorkflow(raw);

  if (workflow.name !== name) {
    throw new HarnessError(`workflow ${name}: name must match the file name`);
  }

  return workflow;
}

/**
 * Builds the harness from its files: principles, a stage per `STAGES`, workflows, lead's rules.
 * @param {HarnessFiles} files Harness files.
 * @returns {Harness} Harness.
 * @throws {HarnessError} If a stage file or the lead's rules are missing, or a stage or workflow
 *   fails validation.
 */
export function parseHarness(files: HarnessFiles): Harness {
  const stages = Object.fromEntries(
    STAGES.map((stage) => [
      stage,
      parseStageGuide(stage, requiredFile(files, `${STAGES_DIRECTORY}${stage}${MARKDOWN}`)),
    ]),
  ) as Record<Stage, StageGuide>;
  const principles = filesIn(files, PRINCIPLES, MARKDOWN).map(([name, text]) => ({
    name,
    text: text.trim(),
  }));
  const workflows = filesIn(files, WORKFLOWS, JSON_EXTENSION).map(([name, text]) =>
    workflowFrom(name, text),
  );

  return { principles, stages, workflows, conductor: requiredFile(files, CONDUCTOR).trim() };
}
